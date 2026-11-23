/**
 * The paper book as kept on this device (version 1; 0 is the same shape, from before versions). A position, order or
 * fill that doesn't read (a NaN price from an older build, a missing field) is dropped and the rest kept, and so is
 * a second order or fill with an id already read (two working orders of one id would both fill on one tick); the next
 * id is past every id in the book. Anything that isn't a book at all is the demo's starting book.
 */
import {
  arrayOf,
  finite,
  isRecord,
  nonEmpty,
  oneOf,
  positive,
  positiveInteger,
  type Kept,
} from "@jali-examples/shared/store";
import type { Side } from "../market/types";
import {
  START,
  type Fill,
  type Ledger,
  type Order,
  type OrderStatus,
  type OrderType,
  type Position,
} from "./ledger";

const side = oneOf<Side>(["buy", "sell"]);
const orderType = oneOf<OrderType>(["market", "limit"]);
const status = oneOf<OrderStatus>(["working", "filled", "cancelled"]);

/** Every field read, or undefined when one didn't. */
const whole = <T extends object>(
  fields: T,
): { [K in keyof T]: Exclude<T[K], undefined> } | undefined =>
  Object.values(fields).some((v) => v === undefined)
    ? undefined
    : (fields as { [K in keyof T]: Exclude<T[K], undefined> });

function position(v: unknown): Position | undefined {
  if (!isRecord(v)) return undefined;
  const avgPrice = finite(v.avgPrice);
  return whole({
    symbol: nonEmpty(v.symbol),
    qty: finite(v.qty),
    avgPrice: avgPrice !== undefined && avgPrice >= 0 ? avgPrice : undefined,
    realized: finite(v.realized),
  });
}

function order(v: unknown): Order | undefined {
  if (!isRecord(v)) return undefined;
  const o = whole({
    id: positiveInteger(v.id),
    symbol: nonEmpty(v.symbol),
    side: side(v.side),
    qty: positive(v.qty),
    status: status(v.status),
    time: finite(v.time),
  });
  const type = orderType(v.type);
  const limit = positive(v.limit);
  if (!o || !type) return undefined;
  if (type === "market") return { ...o, type };
  return limit === undefined ? undefined : { ...o, type, limit };
}

function fill(v: unknown): Fill | undefined {
  if (!isRecord(v)) return undefined;
  return whole({
    id: positiveInteger(v.id),
    orderId: positiveInteger(v.orderId),
    symbol: nonEmpty(v.symbol),
    side: side(v.side),
    qty: positive(v.qty),
    price: positive(v.price),
    time: finite(v.time),
  });
}

/** The rows, without any whose id an earlier row has: the first of each id is kept. */
function firstOfEachId<T extends { id: number }>(rows: T[] | undefined): T[] | undefined {
  const seen = new Set<number>();
  return rows?.filter((r) => !seen.has(r.id) && !!seen.add(r.id));
}

export const KEPT_LEDGER: Kept<Ledger> = {
  key: "markets:book",
  version: 1,
  fallback: START,
  parse(value, version) {
    if (version > 1 || !isRecord(value)) return undefined;
    const positions = arrayOf(value.positions, position);
    const orders = firstOfEachId(arrayOf(value.orders, order));
    const fills = firstOfEachId(arrayOf(value.fills, fill));
    if (!positions || !orders || !fills) return undefined;
    const ids = [...orders.map((o) => o.id), ...fills.map((f) => f.id)];
    const nextId = Math.max(positiveInteger(value.nextId) ?? 1, ...ids.map((id) => id + 1));
    return { positions, orders, fills, nextId };
  },
};
