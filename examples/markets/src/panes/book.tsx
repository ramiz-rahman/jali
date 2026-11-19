/**
 * The order book: ten price levels a side, asks above and bids below the spread. The bar behind each size is the
 * depth to that level, so a wall of orders shows at a glance.
 */
import { StackIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "@jali/react";
import { useTopic } from "../market/react";
import type { BookLevel, Instrument } from "../market/types";
import * as f from "../ui/format";
import { Empty, Known } from "../ui/parts";
import { followSymbol } from "./follow";

/** What a book pane shows; its component and `definePane` share it. */
const bookParams = { symbol: String };

function BookPane({ params, paused }: PaneProps<typeof bookParams>) {
  return (
    <Known symbol={params.symbol}>
      {(inst) =>
        inst.assetClass === "index" ? (
          <Empty icon={<StackIcon size={20} aria-hidden />} title="An index has no order book">
            Its level comes from its members. Open one of them.
          </Empty>
        ) : (
          <BookBody inst={inst} paused={paused} />
        )
      }
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
  const depth = (levels: BookLevel[]) =>
    levels.reduce<number[]>((acc, l) => [...acc, (acc.at(-1) ?? 0) + l.size], []);
  const bidDepth = depth(b.bids);
  const askDepth = depth(b.asks);
  const most = Math.max(bidDepth.at(-1) ?? 1, askDepth.at(-1) ?? 1);
  const bidTotal = bidDepth.at(-1) ?? 0;
  const askTotal = askDepth.at(-1) ?? 0;
  const bidShare = bidTotal / (bidTotal + askTotal || 1);
  // Kraken's book gives sizes, not how many orders make them up.
  const counted = inst.source === undefined;
  const cols = counted ? 3 : 2;

  const row = (l: BookLevel, cum: number, side: "bid" | "ask") => (
    <tr key={`${side}-${l.price}`} data-side={side}>
      <td className="b-price">{f.price(inst, l.price)}</td>
      <td className="b-size">
        <span className="b-bar" style={{ width: `${(cum / most) * 100}%` }} aria-hidden />
        <span>{f.size(l.size)}</span>
      </td>
      {counted ? <td className="b-orders">{l.orders}</td> : null}
    </tr>
  );

  return (
    <div className="pane-body book">
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
          {b.asks
            .map((l, i) => ({ l, cum: askDepth[i]! }))
            .reverse()
            .map(({ l, cum }) => row(l, cum, "ask"))}
          <tr className="b-spread">
            <td colSpan={cols}>
              Spread{" "}
              {b.bids[0] && b.asks[0] ? f.spread(inst, b.bids[0].price, b.asks[0].price) : ""}
            </td>
          </tr>
          {b.bids.map((l, i) => row(l, bidDepth[i]!, "bid"))}
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
    </div>
  );
}

export const book = definePane("book", {
  params: bookParams,
  follow: followSymbol,
  title: ({ symbol }) => `${symbol} book`,
  icon: StackIcon,
  width: { min: 220, comfortable: 280, max: 400 },
  height: { min: 260 },
  Component: BookPane,
});
