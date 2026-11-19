/**
 * A price chart in SVG, with no chart library: candles or a line, today by the minute or up to a year by the day,
 * volume beneath. Hover, or focus it and use the arrows, to read any bar.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { ChartLineIcon } from "@phosphor-icons/react";
import { definePane, useCommands, usePaneState, type PaneProps } from "@jali/react";
import { aggregate, MINUTE } from "../market/history";
import { useTopic } from "../market/react";
import { RANGES, type Bar, type Instrument, type Range } from "../market/types";
import * as f from "../ui/format";
import { Delta, Known, Segmented } from "../ui/parts";
import { useFollowSymbol } from "./follow";

type Style = "candles" | "line";
interface View {
  range: Range;
  style: Style;
}

const AXIS_W = 64; // the price axis, on the right
const AXIS_H = 20; // the time axis, below
const VOLUME = 0.18; // of the plot's height
/** Slots across the chart: a whole session for 1D, so today's line fills in as the day goes on. */
const SESSION_MINUTES = 390;
const SLOTS: Partial<Record<Range, number>> = { "5D": 65 };
/** Minutes a 1D bar may cover: the fewest that keep a candle 5px wide. */
const BUCKETS = [1, 2, 5, 10, 15, 30];

/** What a chart pane shows; its component and `definePane` share it. */
const chartParams = { symbol: String };

function Chart({ params, paused }: PaneProps<typeof chartParams>) {
  useFollowSymbol(chart, params.symbol);
  return (
    <Known symbol={params.symbol}>{(inst) => <ChartBody inst={inst} paused={paused} />}</Known>
  );
}

function ChartBody({ inst, paused }: { inst: Instrument; paused: boolean }) {
  const [view, setView] = usePaneState<View>("view", { range: "1D", style: "candles" });
  const raw = useTopic({ channel: "bars", symbol: inst.symbol, range: view.range }, paused);
  const q = useTopic({ channel: "quote", symbol: inst.symbol }, paused);
  const [cursor, setCursor] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const size = useSize(plotRef);

  // Today comes by the minute (390 bars a session). A narrow chart merges them into wider bars that read better.
  const bucket =
    view.range === "1D"
      ? (BUCKETS.find((m) => (size.width - AXIS_W) / (SESSION_MINUTES / m) >= 5) ?? 30)
      : 1;
  const bars = useMemo(
    () => (bucket > 1 && raw[0] ? aggregate(raw, bucket * MINUTE, raw[0].time) : raw),
    [raw, bucket],
  );
  const slots = view.range === "1D" ? SESSION_MINUTES / bucket : (SLOTS[view.range] ?? bars.length);

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
    const digit = Number(e.key);
    if (digit >= 1 && digit <= RANGES.length) setRange(RANGES[digit - 1]!);
    else if (e.key === "c" || e.key === "C") setStyle("candles");
    else if (e.key === "l" || e.key === "L") setStyle("line");
    else if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, (c ?? last + 1) - step));
    else if (e.key === "ArrowRight")
      setCursor((c) => (c === null ? null : c + step > last ? null : c + step));
    else if (e.key === "Home") setCursor(0);
    else if (e.key === "End") setCursor(null);
    else if (e.key === "Escape" && cursor !== null) setCursor(null);
    else return; // the first Esc with no cursor, and everything else, belongs to the workspace
    e.preventDefault();
  };

  const shown = cursor !== null ? bars[cursor] : bars[bars.length - 1];
  const before =
    cursor !== null && cursor > 0
      ? bars[cursor - 1]!.close
      : view.range === "1D"
        ? inst.prevClose
        : bars[0]?.open;
  const intraday = view.range === "1D" || view.range === "5D";

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
            <span className="readout-time">
              {intraday
                ? view.range === "1D"
                  ? f.hhmm(shown.time)
                  : `${f.weekday(shown.time)} ${f.hhmm(shown.time)}`
                : f.day(shown.time)}
            </span>
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
            ? `${intraday ? f.hhmm(shown.time) : f.day(shown.time)}: open ${f.price(inst, shown.open)}, high ${f.price(inst, shown.high)}, low ${f.price(inst, shown.low)}, close ${f.price(inst, shown.close)}.`
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
            last={q.last}
            prevClose={intraday ? inst.prevClose : undefined}
            cursor={cursor}
            setCursor={setCursor}
          />
        ) : null}
      </div>
    </div>
  );
}

function Plot({
  inst,
  bars,
  view,
  slots: wanted,
  width,
  height,
  last,
  prevClose,
  cursor,
  setCursor,
}: {
  inst: Instrument;
  bars: readonly Bar[];
  view: View;
  slots: number;
  width: number;
  height: number;
  last: number;
  prevClose?: number;
  cursor: number | null;
  setCursor: (i: number | null) => void;
}) {
  const [pointerY, setPointerY] = useState<number | null>(null);
  const plotW = Math.max(10, width - AXIS_W);
  const plotH = Math.max(10, height - AXIS_H);
  const priceH = plotH * (1 - VOLUME) - 6;
  const slots = Math.max(wanted, bars.length);
  const slot = plotW / slots;
  const x = (i: number) => (i + 0.5) * slot;

  // The price scale covers the bars, the last price and yesterday's close, with a little room.
  let lo = Math.min(...bars.map((b) => b.low), last);
  let hi = Math.max(...bars.map((b) => b.high), last);
  if (prevClose !== undefined) [lo, hi] = [Math.min(lo, prevClose), Math.max(hi, prevClose)];
  const pad = (hi - lo || hi * 0.01) * 0.08;
  [lo, hi] = [lo - pad, hi + pad];
  const y = (p: number) => 4 + ((hi - p) / (hi - lo)) * priceH;
  const priceAt = (py: number) => hi - ((py - 4) / priceH) * (hi - lo);
  const ticks = niceTicks(lo, hi, Math.max(3, Math.floor(priceH / 44)));
  const maxVol = Math.max(...bars.map((b) => b.volume), 1);
  const volTop = plotH * (1 - VOLUME);
  const vy = (v: number) => plotH - (v / maxVol) * (plotH * VOLUME - 2);
  const body = Math.max(1, Math.min(slot * 0.68, 14));

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / slot);
    setCursor(i >= 0 && i < bars.length && e.clientX - r.left < plotW ? i : null);
    setPointerY(e.clientY - r.top < priceH + 4 ? e.clientY - r.top : null);
  };
  const onLeave = () => {
    setCursor(null);
    setPointerY(null);
  };

  const dayDir =
    prevClose !== undefined ? f.direction(last - prevClose) : f.direction(last - bars[0]!.open);
  const linePath = bars
    .map((b, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`)
    .join("");
  const timeTicks = timeLabels(bars, view.range, slots);

  return (
    <svg
      width={width}
      height={height}
      className="plot-svg"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-hidden
    >
      <defs>
        <linearGradient id={`area-${inst.symbol}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" className="area-top" />
          <stop offset="1" className="area-bottom" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} className="grid" />
          {/* The last price's tag sits on the axis; a label under it would show through. */}
          {Math.abs(y(t) - y(last)) > 14 ? (
            <text x={plotW + 8} y={y(t) + 4} className="axis-label">
              {f.price(inst, t)}
            </text>
          ) : null}
        </g>
      ))}
      {timeTicks.map(({ i, label }) => (
        <g key={`${i}-${label}`}>
          <line x1={x(i)} x2={x(i)} y1={0} y2={plotH} className="grid grid-v" />
          <text x={x(i)} y={height - 5} className="axis-label axis-time">
            {label}
          </text>
        </g>
      ))}
      <line x1={0} x2={plotW} y1={volTop} y2={volTop} className="grid" />
      {bars.map((b, i) => (
        <rect
          key={b.time}
          x={x(i) - body / 2}
          y={vy(b.volume)}
          width={body}
          height={Math.max(0, plotH - vy(b.volume))}
          className="vol"
          data-dir={b.close >= b.open ? "up" : "down"}
        />
      ))}
      {prevClose !== undefined ? (
        <line x1={0} x2={plotW} y1={y(prevClose)} y2={y(prevClose)} className="prev-close" />
      ) : null}
      {view.style === "line" ? (
        <>
          <path
            d={`${linePath}L${x(bars.length - 1).toFixed(1)},${volTop}L${x(0).toFixed(1)},${volTop}Z`}
            fill={`url(#area-${inst.symbol})`}
          />
          <path d={linePath} className="price-line" />
        </>
      ) : (
        bars.map((b, i) => {
          const dir = b.close > b.open ? "up" : b.close < b.open ? "down" : "flat";
          const top = y(Math.max(b.open, b.close));
          return (
            <g key={b.time} className="candle" data-dir={dir}>
              <line x1={x(i)} x2={x(i)} y1={y(b.high)} y2={y(b.low)} />
              {/* Up candles are hollow, down candles filled: the shape says which way, not only the colour. */}
              <rect
                x={x(i) - body / 2}
                y={top}
                width={body}
                height={Math.max(1, y(Math.min(b.open, b.close)) - top)}
              />
            </g>
          );
        })
      )}
      <line x1={0} x2={plotW} y1={y(last)} y2={y(last)} className="last-line" data-dir={dayDir} />
      <g className="last-tag" data-dir={dayDir}>
        <rect x={plotW + 2} y={y(last) - 9} width={AXIS_W - 4} height={18} rx={3} />
        <text x={plotW + 8} y={y(last) + 4}>
          {f.price(inst, last)}
        </text>
      </g>
      {cursor !== null && bars[cursor] ? (
        <g className="crosshair">
          <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={plotH} />
          {pointerY !== null ? (
            <>
              <line x1={0} x2={plotW} y1={pointerY} y2={pointerY} />
              <rect x={plotW + 2} y={pointerY - 9} width={AXIS_W - 4} height={18} rx={3} />
              <text x={plotW + 8} y={pointerY + 4}>
                {f.price(inst, priceAt(pointerY))}
              </text>
            </>
          ) : (
            <circle cx={x(cursor)} cy={y(bars[cursor]!.close)} r={3} />
          )}
        </g>
      ) : null}
    </svg>
  );
}

/** Round prices for the axis: steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Number(t.toFixed(10)));
  return out;
}

/** Where the time axis gets a label: each hour today, each day over 5D, each week or month beyond. */
function timeLabels(
  bars: readonly Bar[],
  range: Range,
  slots: number,
): { i: number; label: string }[] {
  const out: { i: number; label: string }[] = [];
  // Today: every hour of the session, including the ones still to come.
  if (range === "1D" && bars[0]) {
    const open = bars[0].time;
    const perSlot = (SESSION_MINUTES / slots) * MINUTE;
    for (let t = open + 30 * MINUTE; t < open + SESSION_MINUTES * MINUTE; t += 60 * MINUTE)
      out.push({ i: Math.round((t - open) / perSlot), label: f.hhmm(t) });
    return out;
  }
  bars.forEach((b, i) => {
    const d = new Date(b.time);
    const prev = i ? new Date(bars[i - 1]!.time) : null;
    if (range === "5D") {
      if (!prev || prev.getDate() !== d.getDate()) out.push({ i, label: f.weekday(b.time) });
    } else if (range === "1M") {
      if (prev && d.getDay() < prev.getDay()) out.push({ i, label: f.day(b.time) });
    } else if (prev && prev.getMonth() !== d.getMonth()) {
      out.push({ i, label: d.toLocaleDateString("en-GB", { month: "short" }) });
    }
  });
  return out;
}

/** An element's size, kept up to date. */
function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry!.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export const chart = definePane("chart", {
  params: chartParams,
  title: ({ symbol }) => `${symbol} chart`,
  icon: ChartLineIcon,
  width: { min: 360, comfortable: 560 },
  height: { min: 220 },
  holdWhileResizing: true,
  Component: Chart,
});
