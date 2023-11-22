import './polyfills.js'
import {OfferingRepository} from './offerings.js'

import type { Rfq, Order, Close } from '@tbdex/http-server'

import log from './logger.js'
import { config } from './config.js'
import { Postgres, ExchangeRespository } from './db/index.js'
import { HttpServerShutdownHandler } from './http-shutdown-handler.js'
import { TbdexHttpServer } from '@tbdex/http-server'


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

httpApi.submit('rfq', async (ctx, rfq) => {
  await ExchangeRespository.addMessage({ message: rfq as Rfq })
})

httpApi.submit('order', async (ctx, order) => {
  await ExchangeRespository.addMessage({ message: order as Order })
})

httpApi.submit('close', async (ctx, close) => {
  await ExchangeRespository.addMessage({ message: close as Close })
})

const server = httpApi.listen(config.port, () => {
  log.info(`Mock PFI listening on port ${config.port}`)
})

console.log('PFI DID: ', config.did.id)
console.log('PFI DID KEY: ', JSON.stringify(config.did.privateKey))
console.log('PFI KID: ', config.did.kid)

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