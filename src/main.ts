import './polyfills.js'
import {OfferingRepository} from './offerings.js'

import type { Rfq, Order, Close, Message } from '@tbdex/http-server'
import { Quote, OrderStatus } from "@tbdex/http-server"

import log from './logger.js'
import { config } from './config.js'
import { Postgres, ExchangeRespository } from './db/index.js'
import { HttpServerShutdownHandler } from './http-shutdown-handler.js'
import { TbdexHttpServer } from '@tbdex/http-server'


console.log('PFI DID: ', config.did.id)
console.log('PFI DID KEY: ', JSON.stringify(config.did.privateKey))
console.log('PFI KID: ', config.did.kid)


process.on('unhandledRejection', (reason: any, promise) => {
  log.error(`Unhandled promise rejection. Reason: ${reason}. Promise: ${JSON.stringify(promise)}. Stack: ${reason.stack}`)
})

process.on('uncaughtException', err => {
  log.error('Uncaught exception:', (err.stack || err))
})

// triggered by ctrl+c with no traps in between
process.on('SIGINT', async () => {
  log.info('exit signal received [SIGINT]. starting graceful shutdown')

  gracefulShutdown()
})

// triggered by docker, tiny etc.
process.on('SIGTERM', async () => {
  log.info('exit signal received [SIGTERM]. starting graceful shutdown')

  gracefulShutdown()
})

const httpApi = new TbdexHttpServer({ exchangesApi: ExchangeRespository, offeringsApi: OfferingRepository })

httpApi.submit('rfq', async (ctx, rfq: Rfq) => {
  await ExchangeRespository.addMessage({ message: rfq })

  const offering = await OfferingRepository.getOffering({ id: rfq.offeringId })


  if (rfq.payinMethod.kind == 'CREDIT_CARD_TOKEN' && offering.payinCurrency.currencyCode == 'USD' && offering.payoutCurrency.currencyCode == 'AUD' ) {
    const quote = Quote.create(
      {
        metadata: {
          from: config.did.id,
          to: rfq.from,
          exchangeId: rfq.exchangeId
        },
        data: {
          expiresAt: new Date(2024, 4, 1).toISOString(),
          payin: {
            currencyCode: 'USDC',
            amountSubunits: '100',
          },
          payout: {
            currencyCode: 'AUD',
            amountSubunits: '110'
          }
        }
      }
    )
    await quote.sign(config.did.privateKey, config.did.kid)
    await ExchangeRespository.addMessage({ message: quote as Quote})  

  }
})

httpApi.submit('order', async (ctx, order: Order) => {
  await ExchangeRespository.addMessage({ message: order })

  // first we will charge the card
  // then we will send the money to the bank account

  const quote = await ExchangeRespository.getQuote({ exchangeId: order.exchangeId })
  const rfq = await ExchangeRespository.getRfq({ exchangeId: order.exchangeId })

  const response = await fetch('https://test-api.pinpayments.com/1/charges', {
    method: 'POST',
    headers: {
        'Authorization': 'Basic ' + Buffer.from('pTzmhz6VMu7D4XMzqtM0NQ:').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
        'amount': quote.data.payin.amountSubunits,
        'currency': 'USD',
        'description': 'For remittances',
        'ip_address': '203.192.1.172',
        'email': 'test@testing.com',
        'card_token': rfq.data.payinMethod.paymentDetails['pinPaymentsToken'],
        'metadata[OrderNumber]': '123456',
        'metadata[CustomerName]': 'Roland Robot'
    })
  });

  const data = await response.json();

  await updateOrderStatus(rfq.exchangeId, rfq.from, 'IN_PROGRESS')

  if (data.response && data.response.success) {
      console.log('Charge created successfully. Token:', data.response.token)
  } else {
      console.error('Failed to create charge. Error:', data.response.error_message)
  }  


})

httpApi.submit('close', async (ctx, close) => {
  await ExchangeRespository.addMessage({ message: close as Close })
})

const server = httpApi.listen(config.port, () => {
  log.info(`Mock PFI listening on port ${config.port}`)
})


httpApi.api.get('/', (req, res) => {
  res.send('Please use the tbdex protocol to communicate with this server or a suitable library: https://github.com/TBD54566975/tbdex-protocol')
})

const httpServerShutdownHandler = new HttpServerShutdownHandler(server)


function gracefulShutdown() {
  httpServerShutdownHandler.stop(async () => {
    log.info('http server stopped.')

    log.info('closing Postgres connections')
    await Postgres.close()

    process.exit(0)
  })
}

async function updateOrderStatus(exchangeId:string, to:string, status: string) {
  const orderStatus = OrderStatus.create(
    {
      metadata: {
        from: config.did.id,
        to: to,
        exchangeId: exchangeId
      },
      data: {
        orderStatus: status
      }
    }
  )
  await orderStatus.sign(config.did.privateKey, config.did.kid)
  ExchangeRespository.addMessage({ message: orderStatus as OrderStatus})
}