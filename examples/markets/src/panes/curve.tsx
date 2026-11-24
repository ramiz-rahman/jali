/**
 * The yield curve: government yields by maturity, now and at yesterday's close, with corporate bonds above it.
 * Choose a bond (click, or J/K and Enter) to open its quote beside the curve.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { ChartLineUpIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali-layout/react";
import { isBond } from "../market/classes";
import { useMarket, useQuotes } from "../market/react";
import type { Bond } from "../market/types";
import * as f from "../ui/format";
import { useSize } from "../ui/hooks/useSize";
import { Delta } from "../ui/molecules/Delta";
import { niceTicks } from "../ui/scale";
import { listMove } from "./keys";
import { quote } from "./quote";

/** The spreads traders read off a curve: the long yield less the short, in bp. */
const SPREADS = [
  { label: "2s10s", short: "GOV2Y", long: "GOV10Y" },
  { label: "5s30s", short: "GOV5Y", long: "GOV30Y" },
];

const tenor = (years: number) => (years < 1 ? `${Math.round(years * 12)}M` : `${years}Y`);

function Curve({ paused, openBeside }: PaneProps) {
  const market = useMarket();
  const bonds = market.instruments.filter(isBond).sort((a, b) => a.maturity - b.maturity);
  const govts = bonds.filter((b) => b.assetClass === "govt");
  const quotes = useQuotes(
    bonds.map((b) => b.symbol),
    paused,
  );
  const [at, setAt] = useState(0);
  const yieldOf = (b: Bond) => quotes.get(b.symbol)?.yield?.pct ?? b.prevYield;
  const bySymbol = (symbol: string) => bonds.find((b) => b.symbol === symbol);
  const spreads = SPREADS.map(({ label, short, long }) => {
    const [s, l] = [bySymbol(short), bySymbol(long)];
    return { label, bp: s && l ? (yieldOf(l) - yieldOf(s)) * 100 : 0 };
  });

  const open = (b: Bond) => openBeside(quote({ symbol: b.symbol }));
  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at, bonds.length);
    const current = bonds[at];
    if (to !== null) setAt(to);
    else if (e.key === "Enter" && current) open(current);
    else return;
    e.preventDefault();
  };

  return (
    <div className="pane-body curve">
      <div className="toolbar">
        {spreads.map((s) => (
          <span key={s.label} className="stat">
            {s.label} <Delta value={s.bp}>{f.bp(s.bp)}</Delta>
          </span>
        ))}
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
            const govt = b.assetClass === "govt";
            return (
              <tr
                key={b.symbol}
                aria-current={i === at ? "true" : undefined}
                onClick={() => {
                  setAt(i);
                  open(b);
                }}
              >
                <td>
                  <b>{govt ? tenor(b.maturity) : b.symbol}</b>
                  <span className="sub">
                    {govt ? b.symbol : `${tenor(b.maturity)}, ${b.coupon}%`}
                  </span>
                </td>
                <td className="num">{q?.yield ? f.percent(q.yield.pct) : ""}</td>
                <td className="num">
                  {q?.yield ? <Delta value={q.yield.changeBp}>{f.bp(q.yield.changeBp)}</Delta> : ""}
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

const HEIGHT = 190;
const [LEFT, RIGHT, TOP, BOTTOM] = [44, 16, 12, 22];

function CurvePlot({
  govts,
  corps,
  yieldOf,
  selected,
  onPick,
}: {
  govts: Bond[];
  corps: Bond[];
  yieldOf: (b: Bond) => number;
  selected?: string;
  onPick: (b: Bond) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { width } = useSize(ref);
  const all = [...govts, ...corps];
  const ys = [...all.map(yieldOf), ...govts.map((g) => g.prevYield)];
  const lo = Math.min(...ys) - 0.08;
  const hi = Math.max(...ys) + 0.08;
  const longest = Math.max(...all.map((b) => b.maturity));
  // Maturity on a square-root scale: the short end, where most of the curve's shape is, gets room.
  const x = (years: number) =>
    LEFT + (Math.sqrt(years) / Math.sqrt(longest)) * (width - LEFT - RIGHT);
  const y = (v: number) => TOP + ((hi - v) / (hi - lo)) * (HEIGHT - TOP - BOTTOM);
  const path = (val: (b: Bond) => number) =>
    govts
      .map((g, i) => `${i ? "L" : "M"}${x(g.maturity).toFixed(1)},${y(val(g)).toFixed(1)}`)
      .join("");

  return (
    <div ref={ref} className="curve-plot">
      {width ? (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Government yield curve, now and at yesterday's close"
        >
          {niceTicks(lo, hi, 6).map((t) => (
            <g key={t}>
              <line x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} className="grid" />
              <text x={LEFT - 6} y={y(t) + 4} className="axis-label" textAnchor="end">
                {t.toFixed(2)}%
              </text>
            </g>
          ))}
          {govts.map((g) => (
            <text key={g.symbol} x={x(g.maturity)} y={HEIGHT - 6} className="axis-label axis-time">
              {tenor(g.maturity)}
            </text>
          ))}
          <path d={path((g) => g.prevYield)} className="curve-prev" />
          <path d={path(yieldOf)} className="curve-now" />
          {govts.map((g) => (
            <circle
              key={g.symbol}
              cx={x(g.maturity)}
              cy={y(yieldOf(g))}
              r={selected === g.symbol ? 5 : 3.5}
              className="curve-dot"
              onClick={() => onPick(g)}
            />
          ))}
          {corps.map((c) => {
            const [cx, cy] = [x(c.maturity), y(yieldOf(c))];
            return (
              <g
                key={c.symbol}
                className="curve-corp"
                data-selected={selected === c.symbol ? "" : undefined}
                onClick={() => onPick(c)}
              >
                <rect
                  x={cx - 4}
                  y={cy - 4}
                  width={8}
                  height={8}
                  transform={`rotate(45 ${cx} ${cy})`}
                />
                <text x={cx + 8} y={cy + 4} className="axis-label">
                  {c.symbol}
                </text>
              </g>
            );
          })}
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
