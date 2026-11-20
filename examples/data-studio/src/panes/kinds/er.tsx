import { GitForkIcon } from "@phosphor-icons/react";
import { definePane } from "@jali/react";
import type { TableName } from "#shared/data/types";
import { useCatalog } from "#shared/data/hooks";
import { erRef, tableInfoOf } from "#shared/panes/shared/refs";
import { Shell } from "#shared/panes/shared/states";
import { PaneGate } from "#shared/panes/shared/PaneGate";
import type { PaneProps } from "@jali/react";

const BW = 150,
  GAPY = 12,
  HEAD = 22,
  LINE = 15;

export function ErPane({ params, paused, openBeside }: PaneProps<{ table: string }>) {
  const table = params.table as TableName;
  const cat = useCatalog({ paused });
  const info = tableInfoOf(cat.data, table);
  if (!info || cat.isError)
    return <PaneGate queries={[cat]} gone={!info ? `Table "${table}"` : undefined} />;

  const out = [
    ...new Set(info.columns.filter((c) => c.references).map((c) => c.references!.table)),
  ];
  const inn = [...new Set(info.referencedBy.map((r) => r.table))].filter((t) => t !== table);
  const boxH = (t: TableName) =>
    HEAD + Math.min(5, tableInfoOf(cat.data, t)?.columns.length ?? 0) * LINE + 8;
  const stack = (names: TableName[]) => {
    let y = 8;
    return names.map((n) => {
      const p = { n, y, h: boxH(n) };
      y += p.h + GAPY;
      return p;
    });
  };
  const L = stack(out),
    R = stack(inn);
  const centerH = boxH(table);
  const H = Math.max(
    L.at(-1) ? L.at(-1)!.y + L.at(-1)!.h + 8 : 0,
    R.at(-1) ? R.at(-1)!.y + R.at(-1)!.h + 8 : 0,
    centerH + 16,
  );
  const cy = (H - centerH) / 2;
  const W = BW * 3 + 80,
    cx = BW + 40;

  const box = (t: TableName, x: number, y: number, h: number, current = false) => {
    const ti = tableInfoOf(cat.data, t);
    return (
      <g
        key={t + x}
        transform={`translate(${x},${y})`}
        style={{ cursor: current ? "default" : "pointer" }}
        onClick={() => !current && openBeside(erRef(t))}
      >
        <rect
          width={BW}
          height={h}
          rx={6}
          fill="var(--island)"
          stroke={current ? "var(--accent)" : "var(--z300)"}
          strokeWidth={current ? 1.5 : 1}
        />
        <rect
          width={BW}
          height={HEAD}
          rx={6}
          fill={current ? "var(--accent-soft)" : "var(--er-head)"}
        />
        <text
          x={8}
          y={15}
          style={{
            fill: "var(--er-label)",
            fontFamily: "IBM Plex Sans",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {t}
        </text>
        {(ti?.columns ?? []).slice(0, 5).map((c, i) => (
          <text key={c.name} x={8} y={HEAD + 13 + i * LINE}>
            {c.primaryKey ? "◆ " : c.references ? "→ " : "  "}
            {c.name}
          </text>
        ))}
      </g>
    );
  };
  const link = (x1: number, y1: number, x2: number, y2: number, key: string) => (
    <path
      key={key}
      d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`}
      fill="none"
      stroke="var(--er-link)"
      strokeWidth={1}
    />
  );

  return (
    <Shell>
      <div className="pk-bar">
        <span className="grow pk-meta">
          {out.length} referenced · {inn.length} referencing. Click a table to re-centre.
        </span>
      </div>
      <div className="pk-chart" style={{ overflow: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Relations around ${table}`}
          style={{ maxWidth: W * 1.4 }}
        >
          <style>{`.er text{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:var(--z500)}`}</style>
          <g className="er">
            {L.map((p) => link(BW, p.y + p.h / 2, cx, cy + centerH / 2, "l" + p.n))}
            {R.map((p) => link(cx + BW, cy + centerH / 2, BW * 2 + 80, p.y + p.h / 2, "r" + p.n))}
            {L.map((p) => box(p.n, 0, p.y, p.h))}
            {box(table, cx, cy, centerH, true)}
            {R.map((p) => box(p.n, BW * 2 + 80, p.y, p.h))}
          </g>
        </svg>
        {out.length + inn.length === 0 && (
          <div className="pk-meta">This table has no relations.</div>
        )}
      </div>
    </Shell>
  );
}

export const erKind = definePane("er", {
  params: { table: String },
  title: ({ table }) => `${table} relations`,
  icon: GitForkIcon,
  width: { min: 400, comfortable: 560 },
  height: { min: 240 },
  Component: ErPane,
});
