/**
 * The chart's drawing, in SVG: price and time axes, volume beneath, candles or a line, the last price's tag and a
 * crosshair. It draws what it is given; the pane (index.tsx) chooses the bars and owns the cursor.
 */
import { useState, type PointerEvent } from "react";
import { dayOf } from "../../market/bars";
import type { Bar, Instrument } from "../../market/types";
import * as f from "../../ui/format";
import { niceTicks } from "../../ui/scale";
import { AXIS_H, AXIS_W, axisPrice, timeLabels } from "./axes";
import type { View } from "./index";

const VOLUME = 0.18; // of the plot's height

export function Plot({
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

  const dayDir = f.direction(last - (prevClose ?? bars[0]?.open ?? last));
  const linePath = bars
    .map((b, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(b.close).toFixed(1)}`)
    .join("");
  const timeTicks = timeLabels(bars, view.range, slots, dayOf(inst).minutes);
  const under = cursor !== null ? bars[cursor] : undefined;

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
              {axisPrice(inst, t)}
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
      {cursor !== null && under ? (
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
            <circle cx={x(cursor)} cy={y(under.close)} r={3} />
          )}
        </g>
      ) : null}
    </svg>
  );
}
