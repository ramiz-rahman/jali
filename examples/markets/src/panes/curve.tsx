/**
 * The yield curve: government yields by maturity, now and at yesterday's close, with corporate bonds above it.
 * Choose a bond (click, or J/K and Enter) to open its quote beside the curve.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChartLineUpIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali/react";
import { useMarket, useQuotes } from "../market/react";
import type { Instrument } from "../market/types";
import * as f from "../ui/format";
import { Delta } from "../ui/parts";
import { listMove } from "./keys";
import { niceTicks } from "./chart";
import { quote } from "./quote";

const tenor = (m: number) => (m < 1 ? `${Math.round(m * 12)}M` : `${m}Y`);

function Curve({ paused, openBeside }: PaneProps) {
  const market = useMarket();
  const bonds = market.instruments
    .filter((i) => i.coupon !== undefined)
    .sort((a, b) => a.maturity! - b.maturity!);
  const govts = bonds.filter((b) => b.assetClass === "govt");
  const quotes = useQuotes(
    bonds.map((b) => b.symbol),
    paused,
  );
  const [at, setAt] = useState(0);
  const yieldOf = (i: Instrument) => quotes.get(i.symbol)?.yield ?? i.prevYield!;

  const spread = (a: string, b: string) => {
    const [x, y] = [market.instrument(a), market.instrument(b)];
    return x && y ? (yieldOf(y) - yieldOf(x)) * 100 : 0;
  };
  const open = (i: Instrument) => openBeside(quote({ symbol: i.symbol }));
  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at, bonds.length);
    if (to !== null) setAt(to);
    else if (e.key === "Enter" && bonds[at]) open(bonds[at]!);
    else return;
    e.preventDefault();
  };

  return (
    <div className="pane-body curve">
      <div className="toolbar">
        <span className="stat">
          2s10s <Delta value={spread("GOV2Y", "GOV10Y")}>{f.bp(spread("GOV2Y", "GOV10Y"))}</Delta>
        </span>
        <span className="stat">
          5s30s <Delta value={spread("GOV5Y", "GOV30Y")}>{f.bp(spread("GOV5Y", "GOV30Y"))}</Delta>
        </span>
        <span className="legend">
          <span className="key key-now" /> Now <span className="key key-prev" /> Yesterday{" "}
          <span className="key key-corp" /> Corporate
        </span>
      </div>
      <CurvePlot
        govts={govts}
        corps={bonds.filter((b) => b.assetClass === "corp")}
        yieldOf={yieldOf}
        selected={bonds[at]?.symbol}
        onPick={open}
      />
      <table className="curve-table">
        <caption className="sr-only">Bond yields, shortest first. Enter opens a quote.</caption>
        <thead>
          <tr>
            <th scope="col">Bond</th>
            <th scope="col" className="num">
              Yield
            </th>
            <th scope="col" className="num">
              Change
            </th>
            <th scope="col" className="num c-price">
              Price
            </th>
          </tr>
        </thead>
        <tbody tabIndex={0} onKeyDown={onKeyDown} aria-label="Bonds">
          {bonds.map((b, i) => {
            const q = quotes.get(b.symbol);
            return (
              <tr
                key={b.symbol}
                aria-current={i === at ? "true" : undefined}
                onClick={() => (setAt(i), open(b))}
              >
                <td>
                  <b>{b.assetClass === "govt" ? tenor(b.maturity!) : b.symbol}</b>
                  <span className="sub">
                    {b.assetClass === "govt" ? b.symbol : `${tenor(b.maturity!)}, ${b.coupon}%`}
                  </span>
                </td>
                <td className="num">{q ? f.percent(q.yield!) : ""}</td>
                <td className="num">
                  {q ? <Delta value={q.yieldChangeBp!}>{f.bp(q.yieldChangeBp!)}</Delta> : ""}
                </td>
                <td className="num c-price">{q ? f.price(b, q.last) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CurvePlot({
  govts,
  corps,
  yieldOf,
  selected,
  onPick,
}: {
  govts: Instrument[];
  corps: Instrument[];
  yieldOf: (i: Instrument) => number;
  selected?: string;
  onPick: (i: Instrument) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e!.contentRect.width)));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const height = 190;
  const [left, right, top, bottom] = [44, 16, 12, 22];
  const all = [...govts, ...corps];
  const ys = [...all.map(yieldOf), ...govts.map((g) => g.prevYield!)];
  const lo = Math.min(...ys) - 0.08;
  const hi = Math.max(...ys) + 0.08;
  const maxM = Math.max(...all.map((i) => i.maturity!));
  // Maturity on a square-root scale: the short end, where most of the curve's shape is, gets room.
  const x = (m: number) => left + (Math.sqrt(m) / Math.sqrt(maxM)) * (width - left - right);
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (height - top - bottom);
  const path = (val: (i: Instrument) => number) =>
    govts
      .map((g, i) => `${i ? "L" : "M"}${x(g.maturity!).toFixed(1)},${y(val(g)).toFixed(1)}`)
      .join("");

  return (
    <div ref={ref} className="curve-plot">
      {width ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Government yield curve, now and at yesterday's close"
        >
          {niceTicks(lo, hi, 6).map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={left - 6} y={y(t) + 4} className="axis-label" textAnchor="end">
                {t.toFixed(2)}%
              </text>
            </g>
          ))}
          {govts.map((g) => (
            <text key={g.symbol} x={x(g.maturity!)} y={height - 6} className="axis-label axis-time">
              {tenor(g.maturity!)}
            </text>
          ))}
          <path d={path((g) => g.prevYield!)} className="curve-prev" />
          <path d={path(yieldOf)} className="curve-now" />
          {govts.map((g) => (
            <circle
              key={g.symbol}
              cx={x(g.maturity!)}
              cy={y(yieldOf(g))}
              r={selected === g.symbol ? 5 : 3.5}
              className="curve-dot"
              onClick={() => onPick(g)}
            />
          ))}
          {corps.map((c) => (
            <g
              key={c.symbol}
              className="curve-corp"
              data-selected={selected === c.symbol ? "" : undefined}
              onClick={() => onPick(c)}
            >
              <rect
                x={x(c.maturity!) - 4}
                y={y(yieldOf(c)) - 4}
                width={8}
                height={8}
                transform={`rotate(45 ${x(c.maturity!)} ${y(yieldOf(c))})`}
              />
              <text x={x(c.maturity!) + 8} y={y(yieldOf(c)) + 4} className="axis-label">
                {c.symbol}
              </text>
            </g>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

export const curve = definePane("curve", {
  title: "Yield curve",
  icon: ChartLineUpIcon,
  width: { min: 340, comfortable: 460 },
  height: { min: 300 },
  Component: Curve,
});
