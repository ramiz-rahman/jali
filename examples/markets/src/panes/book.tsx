/**
 * The order book: ten price levels a side, asks above and bids below the spread. The bar behind each size is the
 * depth to that level, so a wall of orders shows at a glance.
 */
import { StackIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali-layout/react";
import { useTopic } from "../market/react";
import type { BookLevel, Instrument } from "../market/types";
import { Scroller } from "../ui/atoms/Scroller";
import * as f from "../ui/format";
import { Empty } from "../ui/molecules/Empty";
import { followSymbol, Known, symbolParams } from "./instrument";

function BookPane({ params, paused }: PaneProps<typeof symbolParams>) {
  return (
    <Known
      symbol={params.symbol}
      untradable={
        <Empty icon={<StackIcon size={20} aria-hidden />} title="An index has no order book">
          Its level comes from its members. Open one of them.
        </Empty>
      }
    >
      {(inst) => <BookBody inst={inst} paused={paused} />}
    </Known>
  );
}

function BookBody({ inst, paused }: { inst: Instrument; paused: boolean }) {
  const b = useTopic({ channel: "book", symbol: inst.symbol }, paused);
  if (!b.bids.length && !b.asks.length)
    return (
      <Empty icon={<StackIcon size={20} aria-hidden />} title="Waiting for the book">
        {inst.source ? `Asking ${inst.source} for ${inst.symbol}'s order book.` : "No orders yet."}
      </Empty>
    );
  const bids = withDepth(b.bids);
  const asks = withDepth(b.asks);
  const bidTotal = bids.at(-1)?.depth ?? 0;
  const askTotal = asks.at(-1)?.depth ?? 0;
  const most = Math.max(bidTotal, askTotal, 1);
  const bidShare = bidTotal / (bidTotal + askTotal || 1);
  // Not every venue says how many orders make up a size (Kraken doesn't).
  const counted = (b.bids[0] ?? b.asks[0])?.orders !== undefined;
  const cols = counted ? 3 : 2;

  const row = (l: Deep, side: "bid" | "ask") => (
    <tr key={`${side}-${l.price}`} data-side={side}>
      <td className="b-price">{f.price(inst, l.price)}</td>
      <td className="b-size">
        <span className="b-bar" style={{ width: `${(l.depth / most) * 100}%` }} aria-hidden />
        <span>{f.size(l.size)}</span>
      </td>
      {counted ? <td className="b-orders">{l.orders ?? ""}</td> : null}
    </tr>
  );

  return (
    <Scroller className="pane-body book" label={`${inst.symbol} order book`}>
      <table className="ladder">
        <caption className="sr-only">
          {inst.symbol} order book: asks, then the spread, then bids
        </caption>
        <thead>
          <tr>
            <th scope="col" className="b-price">
              Price
            </th>
            <th scope="col" className="b-size">
              Size
            </th>
            {counted ? (
              <th scope="col" className="b-orders">
                Orders
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {asks.toReversed().map((l) => row(l, "ask"))}
          <tr className="b-spread">
            <td colSpan={cols}>
              Spread{" "}
              {b.bids[0] && b.asks[0] ? f.spread(inst, b.bids[0].price, b.asks[0].price) : ""}
            </td>
          </tr>
          {bids.map((l) => row(l, "bid"))}
        </tbody>
      </table>
      <div
        className="imbalance"
        aria-label={`Bids ${Math.round(bidShare * 100)}% of the size shown`}
      >
        <span>Bids {Math.round(bidShare * 100)}%</span>
        <div className="imbalance-bar" aria-hidden>
          <span style={{ width: `${bidShare * 100}%` }} />
        </div>
        <span>Asks {100 - Math.round(bidShare * 100)}%</span>
      </div>
    </Scroller>
  );
}

/** A level with the depth to it: its size and every better level's. */
type Deep = BookLevel & { depth: number };

function withDepth(levels: readonly BookLevel[]): Deep[] {
  let depth = 0;
  return levels.map((l) => ({ ...l, depth: (depth += l.size) }));
}

export const book = definePane("book", {
  params: symbolParams,
  follow: followSymbol,
  title: ({ symbol }) => `${symbol} book`,
  icon: StackIcon,
  width: { min: 220, comfortable: 280, max: 400 },
  height: { min: 260 },
  Component: BookPane,
});
