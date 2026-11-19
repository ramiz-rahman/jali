/** Time and sales: every trade as it prints, newest on top. Large prints are marked. */
import { useMemo } from "react";
import { ReceiptIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "@jali/react";
import { useTopic } from "../market/react";
import type { Instrument } from "../market/types";
import * as f from "../ui/format";
import { Arrow, Empty, Known } from "../ui/parts";
import { followSymbol } from "./follow";

const ROWS = 80;

/** What a tape pane shows; its component and `definePane` share it. */
const tapeParams = { symbol: String };

function TapePane({ params, paused }: PaneProps<typeof tapeParams>) {
  return (
    <Known symbol={params.symbol}>
      {(inst) =>
        inst.assetClass === "index" ? (
          <Empty icon={<ReceiptIcon size={20} aria-hidden />} title="An index doesn't trade">
            Its members do. Open one of them.
          </Empty>
        ) : (
          <TapeBody inst={inst} paused={paused} />
        )
      }
    </Known>
  );
}

function TapeBody({ inst, paused }: { inst: Instrument; paused: boolean }) {
  const trades = useTopic({ channel: "trades", symbol: inst.symbol }, paused);
  const shown = trades.slice(0, ROWS);
  // A print four times the usual size stands out.
  const large = useMemo(() => {
    const sizes = trades.map((t) => t.size).sort((a, b) => a - b);
    return (sizes[Math.floor(sizes.length / 2)] ?? Infinity) * 4;
  }, [trades]);

  if (!shown.length) return <Empty title="No trades yet">They appear here as they print.</Empty>;
  return (
    <div className="pane-body tape">
      <table className="tape-table">
        <caption className="sr-only">Trades in {inst.symbol}, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col" className="num">
              Price
            </th>
            <th scope="col" className="num">
              Size
            </th>
            <th scope="col" className="t-side-h">
              <span className="side-word">Side</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((t) => (
            <tr key={t.id} data-side={t.side} data-large={t.size >= large ? "" : undefined}>
              <td className="t-time">{f.time(t.time)}</td>
              <td className="num">{f.price(inst, t.price)}</td>
              <td className="num">{f.size(t.size)}</td>
              <td className="t-side">
                <Arrow dir={t.side === "buy" ? "up" : "down"} />
                <span className="side-word">{t.side === "buy" ? "Buy" : "Sell"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const tape = definePane("tape", {
  params: tapeParams,
  follow: followSymbol,
  title: ({ symbol }) => `${symbol} trades`,
  icon: ReceiptIcon,
  width: { min: 220, comfortable: 280, max: 420 },
  height: { min: 200 },
  holdWhileResizing: true,
  Component: TapePane,
});
