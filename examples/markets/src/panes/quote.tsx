/** One instrument's key figures: the price and today's change, the touch, the day's range, and what it is. */
import { useMemo, type ReactNode } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { definePane, useCommands, useJali, type PaneProps } from "@jali/react";
import { prepareTicket } from "../actions";
import { useMarket, useTopic } from "../market/react";
import type { Instrument, Quote } from "../market/types";
import { useServices } from "../services";
import * as f from "../ui/format";
import { Delta, Figures, Flash, Known } from "../ui/parts";
import { chart } from "./chart";

/** What a quote pane shows; its component and `definePane` share it. */
const quoteParams = { symbol: String };

function QuotePane({ params, paused, node, inPeek, openBeside }: PaneProps<typeof quoteParams>) {
  return (
    <Known symbol={params.symbol}>
      {(inst) => (
        <QuoteBody
          inst={inst}
          paused={paused}
          from={inPeek ? undefined : node.id}
          openChart={() => openBeside(chart({ symbol: inst.symbol }))}
        />
      )}
    </Known>
  );
}

function QuoteBody({
  inst,
  paused,
  from,
  openChart,
}: {
  inst: Instrument;
  paused: boolean;
  from?: string;
  openChart: () => void;
}) {
  const q = useTopic({ channel: "quote", symbol: inst.symbol }, paused);
  const services = useServices();
  const jali = useJali();
  const tradable = inst.assetClass !== "index";
  const trade = (side: "buy" | "sell") => prepareTicket(jali, services, inst.symbol, side, from);
  const isBond = q.yield !== undefined;

  useCommands([
    {
      id: "buy",
      title: `Buy ${inst.symbol}`,
      disabled: tradable ? false : "Indices can't be traded",
      run: () => trade("buy"),
    },
    {
      id: "sell",
      title: `Sell ${inst.symbol}`,
      disabled: tradable ? false : "Indices can't be traded",
      run: () => trade("sell"),
    },
    { id: "chart", title: `Open chart for ${inst.symbol}`, run: openChart },
  ]);

  return (
    <div className="pane-body quote">
      <header className="quote-head">
        <div className="quote-id">
          <b>{inst.symbol}</b>
          <span>{inst.name}</span>
        </div>
        <span className="chip">{CLASS[inst.assetClass]}</span>
      </header>

      <div className="quote-price">
        <span className="quote-last">
          <Flash value={q.last} dir={q.tickDir}>
            {isBond ? f.percent(q.yield!) : f.price(inst, q.last)}
          </Flash>
        </span>
        <span className="quote-change">
          {isBond ? (
            <Delta value={q.yieldChangeBp!}>{f.bp(q.yieldChangeBp!)}</Delta>
          ) : (
            <>
              <Delta value={q.change}>{f.change(inst, q.change)}</Delta>
              <Delta value={q.change}>{f.pct(q.changePct)}</Delta>
            </>
          )}
        </span>
        {isBond ? (
          <span className="quote-sub">
            Price {f.price(inst, q.last)} ·{" "}
            <Delta value={q.change}>{f.change(inst, q.change)}</Delta>
          </span>
        ) : null}
      </div>

      {tradable ? <Touch inst={inst} q={q} /> : null}
      {tradable ? (
        <div className="quote-actions">
          <button type="button" className="btn btn-buy" onClick={() => trade("buy")}>
            Buy
          </button>
          <button type="button" className="btn btn-sell" onClick={() => trade("sell")}>
            Sell
          </button>
          <button type="button" className="btn" onClick={openChart}>
            Chart
          </button>
        </div>
      ) : (
        <p className="note">
          <InfoIcon size={14} aria-hidden /> An index is a measure, not something to trade. Trade
          its members.
        </p>
      )}
      <DayRange inst={inst} q={q} />
      <Figures rows={figures(inst, q, useYearRange(inst))} />
    </div>
  );
}

const CLASS: Record<Instrument["assetClass"], string> = {
  equity: "Equity",
  govt: "Government bond",
  corp: "Corporate bond",
  fx: "FX spot",
  index: "Index",
};

/** Bid and ask with their sizes, and the spread between them in the units traders use. */
function Touch({ inst, q }: { inst: Instrument; q: Quote }) {
  return (
    <div className="touch">
      <div className="touch-side" data-side="bid">
        <span className="touch-label">Bid</span>
        <span className="touch-price">{f.price(inst, q.bid)}</span>
        <span className="touch-size">{f.size(q.bidSize)}</span>
      </div>
      <div className="touch-spread">
        <span className="touch-label">Spread</span>
        <span>{f.spread(inst, q.bid, q.ask)}</span>
      </div>
      <div className="touch-side" data-side="ask">
        <span className="touch-label">Ask</span>
        <span className="touch-price">{f.price(inst, q.ask)}</span>
        <span className="touch-size">{f.size(q.askSize)}</span>
      </div>
    </div>
  );
}

/** Today's low to high, with the open and the last price marked on it. */
function DayRange({ inst, q }: { inst: Instrument; q: Quote }) {
  const span = q.high - q.low || 1;
  const at = (p: number) => `${((p - q.low) / span) * 100}%`;
  return (
    <div className="range">
      <div className="range-labels">
        <span>Low {f.price(inst, q.low)}</span>
        <span>Day range</span>
        <span>High {f.price(inst, q.high)}</span>
      </div>
      <div
        className="range-bar"
        role="img"
        aria-label={`Last ${f.price(inst, q.last)}, between today's low and high`}
      >
        <span
          className="range-open"
          style={{ left: at(q.open) }}
          title={`Open ${f.price(inst, q.open)}`}
        />
        <span className="range-last" style={{ left: at(q.last) }} />
      </div>
    </div>
  );
}

/** The year's low and high, from the 1Y bars (read once: it hardly moves). */
function useYearRange(inst: Instrument) {
  const market = useMarket();
  return useMemo(() => {
    const bars = market.snapshot({ channel: "bars", symbol: inst.symbol, range: "1Y" });
    return { low: Math.min(...bars.map((b) => b.low)), high: Math.max(...bars.map((b) => b.high)) };
  }, [market, inst.symbol]);
}

function figures(
  inst: Instrument,
  q: Quote,
  year: { low: number; high: number },
): [string, ReactNode][] {
  const p = (x: number) => f.price(inst, x);
  const rows: [string, ReactNode][] = [
    ["Open", p(q.open)],
    ["Prev close", p(q.prevClose)],
  ];
  if (inst.assetClass === "equity")
    rows.push(
      ["Volume", f.size(q.volume)],
      ["VWAP", p(q.vwap)],
      ["Market value", `${f.size(q.last * inst.shares!)}`],
      ["Sector", inst.group],
    );
  if (inst.coupon !== undefined)
    rows.push(
      ["Coupon", `${inst.coupon.toFixed(3)}%`],
      [
        "Maturity",
        inst.maturity! < 1 ? `${Math.round(inst.maturity! * 12)} months` : `${inst.maturity} years`,
      ],
      ["Volume", f.size(q.volume)],
      [
        "Issuer",
        inst.assetClass === "govt" ? "Government" : inst.name.split(" ").slice(0, -2).join(" "),
      ],
    );
  if (inst.assetClass === "fx")
    rows.push(
      ["Volume", `${f.size(q.volume)} ${inst.symbol.slice(0, 3)}`],
      ["Quoted in", inst.currency],
    );
  if (inst.assetClass === "index")
    rows.push(["Members", String(inst.members!.length)], ["Tracks", inst.group]);
  rows.push(["52-week range", `${p(year.low)} – ${p(year.high)}`]);
  return rows;
}

export const quote = definePane("quote", {
  params: quoteParams,
  title: ({ symbol }) => `${symbol} quote`,
  icon: InfoIcon,
  width: { min: 260, comfortable: 300, max: 440 },
  height: { min: 240 },
  Component: QuotePane,
});
