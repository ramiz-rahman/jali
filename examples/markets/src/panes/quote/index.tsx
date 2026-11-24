/**
 * One instrument's key figures: the price and today's change, the touch (Touch.tsx), the day's range (DayRange.tsx),
 * and what it is (figures.ts).
 */
import { useMemo } from "react";
import { InfoIcon } from "@phosphor-icons/react";
import { definePane, useCommands, useJali, type PaneProps } from "jali-layout/react";
import { facts } from "../../market/classes";
import { useFeed, useTopic } from "../../market/react";
import type { Instrument, Quote, Side } from "../../market/types";
import { useServices } from "../../services";
import { Flash } from "../../ui/atoms/Flash";
import * as f from "../../ui/format";
import { Delta } from "../../ui/molecules/Delta";
import { Empty } from "../../ui/molecules/Empty";
import { Figures } from "../../ui/molecules/Figures";
import { prepareTicket } from "../../workspace/actions";
import { chart } from "../chart";
import { Known, symbolParams } from "../instrument";
import { DayRange } from "./DayRange";
import { figures, type YearRange } from "./figures";
import { Touch } from "./Touch";

function QuotePane({ params, paused, node, inPeek, openBeside }: PaneProps<typeof symbolParams>) {
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
  const { ticket } = useServices();
  const jali = useJali();
  const feed = useFeed();
  const { tradable, label } = facts(inst);
  const trade = (side: Side) => prepareTicket(jali, ticket, { symbol: inst.symbol, side }, from);
  const notTradable = tradable ? false : "Indices can't be traded";

  useCommands([
    { id: "buy", title: `Buy ${inst.symbol}`, disabled: notTradable, run: () => trade("buy") },
    { id: "sell", title: `Sell ${inst.symbol}`, disabled: notTradable, run: () => trade("sell") },
    { id: "chart", title: `Open chart for ${inst.symbol}`, run: openChart },
  ]);

  return (
    <div className="pane-body quote">
      <header className="quote-head">
        <div className="quote-id">
          <b>{inst.symbol}</b>
          <span>{inst.name}</span>
        </div>
        <span className="chip">{label}</span>
        {inst.source ? (
          feed === "down" ? (
            <span className="chip" title={`${inst.source} can't be reached; trying again`}>
              Offline · {inst.source}
            </span>
          ) : (
            <span className="chip chip-live" title={`Real prices from ${inst.source}`}>
              Live · {inst.source}
            </span>
          )
        ) : null}
      </header>

      {q ? (
        <QuoteNumbers
          inst={inst}
          q={q}
          paused={paused}
          trade={tradable ? trade : undefined}
          openChart={openChart}
        />
      ) : (
        <Empty title={`${inst.symbol}'s price is not known yet`}>
          {feed === "down"
            ? `${inst.source ?? "The feed"} can't be reached. Prices fill in when it answers again.`
            : `Waiting for the first quote from ${inst.source ?? "the feed"}.`}
        </Empty>
      )}
    </div>
  );
}

/** The quote's numbers: the price and change, the touch, the actions, the day's range and the figures. A bond leads
 *  with its yield. `trade` is absent for what can't be traded. */
function QuoteNumbers({
  inst,
  q,
  paused,
  trade,
  openChart,
}: {
  inst: Instrument;
  q: Quote;
  paused: boolean;
  trade?: (side: Side) => void;
  openChart: () => void;
}) {
  const year = useYearRange(inst, paused);
  return (
    <>
      <div className="quote-price">
        <span className="quote-last">
          <Flash value={q.last} dir={q.tickDir}>
            {q.yield ? f.percent(q.yield.pct) : f.price(inst, q.last)}
          </Flash>
        </span>
        <span className="quote-change">
          {q.yield ? (
            <Delta value={q.yield.changeBp}>{f.bp(q.yield.changeBp)}</Delta>
          ) : (
            <>
              <Delta value={q.change}>{f.change(inst, q.change)}</Delta>
              <Delta value={q.change}>{f.pct(q.changePct)}</Delta>
            </>
          )}
        </span>
        {q.yield ? (
          <span className="quote-sub">
            Price {f.price(inst, q.last)} ·{" "}
            <Delta value={q.change}>{f.change(inst, q.change)}</Delta>
          </span>
        ) : null}
      </div>

      {trade ? (
        <>
          <Touch inst={inst} q={q} />
          <div className="quote-actions">
            <button type="button" className="btn btn-buy" onClick={() => trade("buy")}>
              {f.SIDE.buy.verb}
            </button>
            <button type="button" className="btn btn-sell" onClick={() => trade("sell")}>
              {f.SIDE.sell.verb}
            </button>
            <button type="button" className="btn" onClick={openChart}>
              Chart
            </button>
          </div>
        </>
      ) : (
        <p className="note">
          <InfoIcon size={14} aria-hidden /> An index is a measure, not something to trade. Trade
          its members.
        </p>
      )}
      <DayRange inst={inst} q={q} />
      <Figures rows={figures(inst, q, year)} />
    </>
  );
}

/** The year's low and high, from the 1Y bars: they hardly move, so they are read every few seconds, not every tick.
 *  A live feed may still be loading them: null until they come. */
function useYearRange(inst: Instrument, paused: boolean): YearRange | null {
  const bars = useTopic({ channel: "bars", symbol: inst.symbol, range: "1Y" }, paused, {
    throttleMs: 5000,
  });
  return useMemo(
    () =>
      bars.length
        ? { low: Math.min(...bars.map((b) => b.low)), high: Math.max(...bars.map((b) => b.high)) }
        : null,
    [bars],
  );
}

export const quote = definePane("quote", {
  params: symbolParams,
  title: ({ symbol }) => `${symbol} quote`,
  icon: InfoIcon,
  width: { min: 260, comfortable: 300, max: 440 },
  height: { min: 240 },
  Component: QuotePane,
});
