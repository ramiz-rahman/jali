import { ChartBarIcon } from "@phosphor-icons/react";
import { definePane } from "@jali/react";
import type { Row } from "#shared/data/types";
import { useMemo, useState } from "react";
import { isLoading } from "#shared/data/hooks";
import { formatCompact, formatCount } from "#shared/panes/format";
import { Empty, Shell } from "#shared/panes/shared/states";
import { PaneGate } from "#shared/panes/shared/PaneGate";
import { useResultWindow } from "#shared/panes/grid/useWindow";
import type { PaneProps } from "@jali/react";

const MAX_BARS = 20;

/** A bar chart of the same result handle the grid reads (same cache key, so no second fetch). */
/** The result handle to chart; empty until the linked query has run. */
export const chartParams = { runId: String };

export function ChartPane({ params, paused }: PaneProps<typeof chartParams>) {
  const runId = params.runId;
  const w = useResultWindow(runId, 0, paused);
  const q = w.q;
  const rows = w.rows;
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);
  const auto = useMemo(() => pickChartColumns(rows, columns), [rows, columns]);
  const [xSel, setX] = useState<string | null>(null);
  const [ySel, setY] = useState<string | null>(null);
  const x = xSel ?? auto.x,
    y = ySel ?? auto.y;

  if (isLoading(q) || q.isError || !runId) {
    return <PaneGate queries={[q]} gone={!runId ? "This result" : undefined} />;
  }
  if (!rows.length)
    return (
      <Shell>
        <Empty title="Nothing to chart" hint="The result has no rows." />
      </Shell>
    );
  const numeric = columns.filter((c) => typeof rows[0]?.[c] === "number");
  if (!x || !y || !numeric.length)
    return (
      <Shell>
        <Empty title="No numeric column" hint="Charts need one number column to measure." />
      </Shell>
    );

  const data = rows
    .slice(0, MAX_BARS)
    .map((r) => ({ label: String(r[x] ?? "NULL"), value: Number(r[y] ?? 0) }));
  const max = Math.max(...data.map((d) => d.value), 0),
    min = Math.min(...data.map((d) => d.value), 0);
  const W = 340,
    rowH = 26,
    labelW = 96,
    valueW = 52,
    top = 4;
  const H = data.length * rowH + top + 18;
  const span = max - min || 1,
    plotW = W - labelW - valueW;
  const zero = labelW + ((0 - min) / span) * plotW;
  const ticks = [min, (min + max) / 2, max];

  return (
    <Shell>
      <div className="pk-bar">
        <label className="pk-meta">
          Label{" "}
          <select value={x} onChange={(e) => setX(e.target.value)} aria-label="Label column">
            {columns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="pk-meta">
          Value{" "}
          <select value={y} onChange={(e) => setY(e.target.value)} aria-label="Value column">
            {numeric.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <span className="grow" />
        <span className="pk-meta pk-mono">{formatCount(rows.length)} rows</span>
      </div>
      <div className="pk-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Bar chart of ${y} by ${x}`}
          preserveAspectRatio="xMinYMin meet"
        >
          {ticks.map((t, i) => {
            const tx = labelW + ((t - min) / span) * plotW;
            return (
              <g key={i}>
                <line x1={tx} x2={tx} y1={top} y2={H - 16} stroke="var(--z200)" strokeWidth={1} />
                <text x={tx} y={H - 4} textAnchor="middle">
                  {formatCompact(t)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const vx = labelW + ((d.value - min) / span) * plotW;
            const bx = Math.min(zero, vx),
              bw = Math.max(1, Math.abs(vx - zero));
            const yy = top + i * rowH;
            return (
              <g key={i}>
                <text
                  x={labelW - 8}
                  y={yy + rowH / 2 + 3}
                  textAnchor="end"
                  style={{ fill: "var(--chart-label)" }}
                >
                  {d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}
                </text>
                <rect x={bx} y={yy + 4} width={bw} height={rowH - 10} rx={2} fill="var(--accent)">
                  <title>{`${d.label}: ${formatCount(d.value)}`}</title>
                </rect>
                <text x={vx + 6} y={yy + rowH / 2 + 3}>
                  {formatCompact(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
        {rows.length > MAX_BARS && (
          <div className="pk-meta">
            Showing the first {MAX_BARS} of {formatCount(rows.length)} rows.
          </div>
        )}
      </div>
    </Shell>
  );
}

export const chartKind = definePane("chart", {
  params: chartParams,
  title: "Chart",
  icon: ChartBarIcon,
  width: { min: 360, comfortable: 480 },
  height: { min: 220 },
  inRecent: ({ runId }) => !!runId,
  Component: ChartPane,
});

/** Pick a label column (first text) and a value column (first numeric) for charting a result. */
export function pickChartColumns(
  rows: Row[],
  columns: string[],
): { x: string | null; y: string | null } {
  const sample = rows[0];
  if (!sample) return { x: null, y: null };
  const y =
    columns.find((c) => typeof sample[c] === "number" && !/(^id$|_id$)/.test(c)) ??
    columns.find((c) => typeof sample[c] === "number") ??
    null;
  const x =
    columns.find((c) => c !== y && typeof sample[c] === "string") ??
    columns.find((c) => c !== y) ??
    null;
  return { x, y };
}
