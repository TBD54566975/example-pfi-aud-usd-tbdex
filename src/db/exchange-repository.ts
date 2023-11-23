import { Close, MessageKind, MessageKindClass, Order, OrderStatus, Quote, ExchangesApi, Rfq, GetExchangesFilter, MessageModel } from '@tbdex/http-server'
import { Message } from '@tbdex/http-server'

import { Postgres } from './postgres.js'
import { config } from '../config.js'

await Postgres.connect()
// await Postgres.ping()
await Postgres.clear()


class _ExchangeRepository implements ExchangesApi {
  async getExchanges(opts: { filter: GetExchangesFilter }): Promise<MessageKindClass[][]> {
    // TODO: try out GROUP BY! would do it now, just unsure what the return structure looks like
    const exchangeIds = opts.filter.id?.length ? opts.filter.id : []

    if (exchangeIds.length == 0) {
      return this.getAllExchanges()
    }

    const exchanges: MessageKindClass[][] = []
    for (let id of exchangeIds) {
      // TODO: handle error property
      try {
        const exchange = await this.getExchange({ id })
        if (exchange.length) exchanges.push(exchange)
        else console.error(`Could not find exchange with exchangeId ${id}`)
      } catch (err) {
        console.error(err)
      }
    }

    return exchanges
  }

  async getAllExchanges(): Promise<MessageKindClass[][]> {
    const results = await Postgres.client.selectFrom('exchange')
      .select(['message'])
      .orderBy('createdat', 'asc')
      .execute()

    return this.composeMessages(results)
  }

  async getExchange(opts: { id: string }): Promise<MessageKindClass[]> {
    const results = await Postgres.client.selectFrom('exchange')
      .select(['message'])
      .where(eb => eb.and({
        exchangeid: opts.id,
      }))
      .orderBy('createdat', 'asc')
      .execute()

    const messages = this.composeMessages(results)

    return messages[0] ?? []
  }

  private composeMessages(results: { message: MessageModel<MessageKind> }[]): MessageKindClass[][] {
    const exchangeIdsToMessages: {[key: string]: MessageKindClass[]} = {}

    for (let result of results) {
      const message = Message.fromJson(result.message)
      const exchangeId = message.exchangeId
      if (exchangeIdsToMessages[exchangeId]) {
        exchangeIdsToMessages[exchangeId].push(message)
      } else {
        exchangeIdsToMessages[exchangeId] = [message]
      }
    }

    return Object.values(exchangeIdsToMessages)
  }

  async getRfq(opts: { exchangeId: string }): Promise<Rfq> {
    return await this.getMessage({ exchangeId: opts.exchangeId, messageKind: 'rfq' }) as Rfq
  }

  async getQuote(opts: { exchangeId: string }): Promise<Quote> {
    return await this.getMessage({ exchangeId: opts.exchangeId, messageKind: 'quote' }) as Quote
  }

  async getOrder(opts: { exchangeId: string }): Promise<Order> {
    return await this.getMessage({ exchangeId: opts.exchangeId, messageKind: 'order' }) as Order
  }

  async getOrderStatuses(opts: { exchangeId: string }): Promise<OrderStatus[]> {
    const results = await Postgres.client.selectFrom('exchange')
      .select(['message'])
      .where(eb => eb.and({
        exchangeid: opts.exchangeId,
        messagekind: 'orderstatus'
      }))
      .execute()

    const orderStatuses: OrderStatus[] = []

    for (let result of results) {
      const orderStatus = Message.fromJson(result.message) as OrderStatus
      orderStatuses.push(orderStatus)
    }

    return orderStatuses
  }

  async getClose(opts: { exchangeId: string }): Promise<Close> {
    return await this.getMessage({ exchangeId: opts.exchangeId, messageKind: 'order' }) as Close
  }

  async getMessage(opts: { exchangeId: string, messageKind: MessageKind }) {
    const result = await Postgres.client.selectFrom('exchange')
      .select(['message'])
      .where(eb => eb.and({
        exchangeid: opts.exchangeId,
        messagekind: opts.messageKind
      }))
      .limit(1)
      .executeTakeFirst()

    if (result) {
      return Message.fromJson(result.message)
    }
  }

  async addMessage(opts: { message: MessageKindClass }) {
    const { message } = opts
    const subject = aliceMessageKinds.has(message.kind) ? message.from : message.to

    const result = await Postgres.client.insertInto('exchange')
      .values({
        exchangeid: message.exchangeId,
        messagekind: message.kind,
        messageid: message.id,
        subject,
        message: JSON.stringify(message)
      })
      .execute()

    //console.log(`Add ${message.kind} Result: ${JSON.stringify(result, null, 2)}`)

    if (message.kind == 'order') {
      const orderStatus = OrderStatus.create(
        {
          metadata: {
            from: config.did.id,
            to: message.from,
            exchangeId: message.exchangeId
          },
          data: {
            orderStatus: 'COMPLETED'
          }
        }
      )
      await orderStatus.sign(config.did.privateKey, config.did.kid)
      this.addMessage({ message: orderStatus as OrderStatus})
    }
  }
}

const aliceMessageKinds = new Set(['rfq', 'order'])

export const ExchangeRespository = new _ExchangeRepository()