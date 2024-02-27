import type {
  Close,
  Message,
  Order,
  OrderStatus,
  Quote,
  ExchangesApi,
  Rfq,
  GetExchangesFilter,
  MessageModel,
  MessageKind,
} from "@tbdex/http-server";
import { Parser } from "@tbdex/http-server";

import { Postgres } from "./postgres.js";

await Postgres.connect();
// await Postgres.ping()
await Postgres.clear();

class _ExchangeRepository implements ExchangesApi {
  async getExchanges(opts: {
    filter: GetExchangesFilter;
  }): Promise<Message[][]> {
    const exchangeIds = opts.filter.id?.length ? opts.filter.id : [];

    if (exchangeIds.length == 0) {
      return await this.getAllExchanges();
    }

    const exchanges: Message[][] = [];
    for (let id of exchangeIds) {
      console.log("calling id", id);
      const exchange = await this.getExchange({ id }).catch((_e) => []);
      exchanges.push(exchange);
    }

    return exchanges;
  }

  async getAllExchanges(): Promise<Message[][]> {
    const results = await Postgres.client
      .selectFrom("exchange")
      .select(["message"])
      .orderBy("createdat", "asc")
      .execute();

    return await this.composeMessages(results);
  }

  async getExchange(opts: { id: string }): Promise<Message[]> {
    console.log("getting exchange for id", opts.id);
    const results = await Postgres.client
      .selectFrom("exchange")
      .select(["message"])
      .where((eb) =>
        eb.and({
          exchangeid: opts.id,
        }),
      )
      .orderBy("createdat", "asc")
      .execute();

    return (await this.composeMessages(results))[0] ?? [];
  }

  private async composeMessages(
    results: { message: MessageModel }[],
  ): Promise<Message[][]> {
    const exchangeIdsToMessages: { [key: string]: Message[] } = {};

    for (let result of results) {
      const message = await Parser.parseMessage(result.message);
      const exchangeId = message.metadata.exchangeId;
      if (exchangeIdsToMessages[exchangeId]) {
        exchangeIdsToMessages[exchangeId].push(message);
      } else {
        exchangeIdsToMessages[exchangeId] = [message];
      }
    }

    return Object.values(exchangeIdsToMessages);
  }

  async getRfq(opts: { exchangeId: string }): Promise<Rfq> {
    return (await this.getMessage({
      exchangeId: opts.exchangeId,
      messageKind: "rfq",
    })) as Rfq;
  }

  async getQuote(opts: { exchangeId: string }): Promise<Quote> {
    return (await this.getMessage({
      exchangeId: opts.exchangeId,
      messageKind: "quote",
    })) as Quote;
  }

  async getOrder(opts: { exchangeId: string }): Promise<Order> {
    return (await this.getMessage({
      exchangeId: opts.exchangeId,
      messageKind: "order",
    })) as Order;
  }

  async getOrderStatuses(opts: { exchangeId: string }): Promise<OrderStatus[]> {
    const results = await Postgres.client
      .selectFrom("exchange")
      .select(["message"])
      .where((eb) =>
        eb.and({
          exchangeid: opts.exchangeId,
          messagekind: "orderstatus",
        }),
      )
      .execute();

    const orderStatuses: OrderStatus[] = [];

    for (let result of results) {
      const orderStatus = (await Parser.parseMessage(
        result.message,
      )) as OrderStatus;
      orderStatuses.push(orderStatus);
    }

    return orderStatuses;
  }

  async getClose(opts: { exchangeId: string }): Promise<Close> {
    return (await this.getMessage({
      exchangeId: opts.exchangeId,
      messageKind: "close",
    })) as Close;
  }

  async getMessage(opts: { exchangeId: string; messageKind: MessageKind }) {
    const result = await Postgres.client
      .selectFrom("exchange")
      .select(["message"])
      .where((eb) =>
        eb.and({
          exchangeid: opts.exchangeId,
          messagekind: opts.messageKind,
        }),
      )
      .limit(1)
      .executeTakeFirst();

    if (result) {
      return await Parser.parseMessage(result.message);
    }
  }

  async addMessage(opts: { message: Message }) {
    const { message } = opts;
    const subject = aliceMessageKinds.has(message.kind)
      ? message.metadata.from
      : message.metadata.to;

    const result = await Postgres.client
      .insertInto("exchange")
      .values({
        exchangeid: message.metadata.exchangeId,
        messagekind: message.kind,
        messageid: message.id,
        subject,
        message: JSON.stringify(message),
      })
      .execute();

    console.log(
      `Add ${message.kind} Message Result: ${JSON.stringify(result, null, 2)}`,
    );
  }
}

const aliceMessageKinds = new Set(["rfq", "order"]);

export const ExchangeRespository = new _ExchangeRepository();
