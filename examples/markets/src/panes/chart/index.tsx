/**
 * A price chart in SVG, with no chart library: candles or a line, today by the minute or up to a year by the day,
 * volume beneath. Hover, or focus it and use the arrows, to read any bar. The drawing is Plot.tsx; where bars and
 * labels go is axes.ts.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChartLineIcon } from "@phosphor-icons/react";
import { definePane, useCommands, usePaneState, type PaneProps } from "jali/react";
import { isRecord, oneOf } from "@jali-examples/shared/store";
import { useTopic } from "../../market/react";
import { RANGES, type Bar, type Instrument, type Quote, type Range } from "../../market/types";
import * as f from "../../ui/format";
import { useSize } from "../../ui/hooks/useSize";
import { Delta } from "../../ui/molecules/Delta";
import { Segmented } from "../../ui/molecules/Segmented";
import { followSymbol, Known, symbolParams } from "../instrument";
import { barTime, fit } from "./axes";
import { Plot } from "./Plot";

type Style = "candles" | "line";
export interface View {
  range: Range;
  style: Style;
}
const range = oneOf(RANGES);
const style = oneOf<Style>(["candles", "line"]);
/** The view kept in pane state, as read back: both fields, or the default. */
const parseView = (v: unknown): View | undefined => {
  if (!isRecord(v)) return undefined;
  const r = range(v.range);
  const s = style(v.style);
  return r && s ? { range: r, style: s } : undefined;
};

function Chart({ params, paused }: PaneProps<typeof symbolParams>) {
  return (
    <Known symbol={params.symbol}>{(inst) => <ChartBody inst={inst} paused={paused} />}</Known>
  );
}

/** What a bar's change is measured from: the bar before it, else yesterday's close today, else the first open. */
function changeBase(bars: readonly Bar[], cursor: number | null, range: Range, q: Quote | null) {
  if (cursor !== null && cursor > 0) return bars[cursor - 1]?.close;
  if (range === "1D" && q) return q.prevClose;
  return bars[0]?.open;
}

function ChartBody({ inst, paused }: { inst: Instrument; paused: boolean }) {
  const [view, setView] = usePaneState<View>(
    "view",
    { range: "1D", style: "candles" },
    { parse: parseView },
  );
  const raw = useTopic({ channel: "bars", symbol: inst.symbol, range: view.range }, paused);
  const q = useTopic({ channel: "quote", symbol: inst.symbol }, paused);
  const [cursor, setCursor] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const size = useSize(plotRef);
  // Merged once per new bar or width, not on every move of the cursor.
  const { bars, slots } = useMemo(
    () => fit(raw, inst, view.range, size.width),
    [raw, inst, view.range, size.width],
  );
  const intraday = view.range === "1D" || view.range === "5D";

  // A new instrument or range starts with no bar under the cursor.
  useEffect(() => setCursor(null), [inst.symbol, view.range]);

  const setRange = (range: Range) => setView((v) => ({ ...v, range }));
  const setStyle = (style: Style) => setView((v) => ({ ...v, style }));

  useCommands([
    ...RANGES.map((r, i) => ({
      id: `range-${r}`,
      title: `Chart range: ${r}`,
      keys: String(i + 1),
      disabled: view.range === r ? "Showing it now" : (false as const),
      run: () => setRange(r),
    })),
    {
      id: "style",
      title: view.style === "candles" ? "Show as a line" : "Show as candles",
      keys: view.style === "candles" ? "L" : "C",
      run: () => setStyle(view.style === "candles" ? "line" : "candles"),
    },
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const last = bars.length - 1;
    const step = e.shiftKey ? 10 : 1;
    const digit = RANGES[Number(e.key) - 1];
    if (digit) setRange(digit);
    else if (e.key === "c" || e.key === "C") setStyle("candles");
    else if (e.key === "l" || e.key === "L") setStyle("line");
    else if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, (c ?? last + 1) - step));
    else if (e.key === "ArrowRight")
      setCursor((c) => (c === null || c + step > last ? null : c + step));
    else if (e.key === "Home") setCursor(0);
    else if (e.key === "End") setCursor(null);
    else if (e.key === "Escape" && cursor !== null) setCursor(null);
    else return; // the first Esc with no cursor, and everything else, belongs to the workspace
    e.preventDefault();
  };

  const shown = cursor !== null ? bars[cursor] : bars.at(-1);
  const before = changeBase(bars, cursor, view.range, q);

  return (
    <div className="pane-body chart">
      <div className="toolbar">
        <Segmented
          label="Range"
          value={view.range}
          onChange={setRange}
          options={RANGES.map((r, i) => ({ value: r, label: r, title: `${r} (${i + 1})` }))}
        />
        <Segmented
          label="Style"
          value={view.style}
          onChange={setStyle}
          options={[
            { value: "candles", label: "Candles", title: "Candles (C)" },
            { value: "line", label: "Line", title: "Line (L)" },
          ]}
        />
        {shown ? (
          <span className="readout" aria-live="off">
            <span className="readout-time">{barTime(view.range, shown.time)}</span>
            <span>
              <i>O</i> {f.price(inst, shown.open)}
            </span>
            <span>
              <i>H</i> {f.price(inst, shown.high)}
            </span>
            <span>
              <i>L</i> {f.price(inst, shown.low)}
            </span>
            <span>
              <i>C</i> {f.price(inst, shown.close)}
            </span>
            {before !== undefined ? (
              <Delta value={shown.close - before}>
                {f.pct(((shown.close - before) / before) * 100)}
              </Delta>
            ) : null}
            {shown.volume ? (
              <span className="readout-vol">
                <i>Vol</i> {f.size(shown.volume)}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
      <div
        ref={plotRef}
        className="plot"
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`${inst.symbol} ${view.range} chart. Left and right arrows read each bar; 1 to 5 change the range.`}
        onKeyDown={onKeyDown}
      >
        {/* Read out the bar under the keyboard cursor; the live price is in the readout, not announced on every tick. */}
        <p className="sr-only" aria-live="polite">
          {cursor !== null && shown
            ? `${barTime(view.range, shown.time)}: open ${f.price(inst, shown.open)}, high ${f.price(inst, shown.high)}, low ${f.price(inst, shown.low)}, close ${f.price(inst, shown.close)}.`
            : ""}
        </p>
        {size.width > 0 && bars.length ? (
          <Plot
            inst={inst}
            bars={bars}
            view={view}
            slots={slots}
            width={size.width}
            height={size.height}
            // Before the first live quote, the latest bar's close stands in: never a placeholder 0.
            last={q?.last ?? bars.at(-1)?.close ?? 0}
            prevClose={intraday ? q?.prevClose : undefined}
            cursor={cursor}
            setCursor={setCursor}
          />
        ) : null}
      </div>
    </div>
  );
}

export const chart = definePane("chart", {
  params: symbolParams,
  follow: followSymbol,
  title: ({ symbol }) => `${symbol} chart`,
  icon: ChartLineIcon,
  width: { min: 360, comfortable: 560 },
  height: { min: 220 },
  holdWhileResizing: true,
  Component: Chart,
});
