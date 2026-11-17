import type { TableName } from "../data/types";
import { errorText, isLoading, useCatalog } from "../data/hooks";
import { erRef, tableInfoOf } from "./format";
import { ErrorState, Gone, Loading, Shell } from "./states";
import type { PaneComponentProps } from "../ui/pane-kinds";

const BW = 150, GAPY = 12, HEAD = 22, LINE = 15;

export function ErPane({ ref, paused, openBeside }: PaneComponentProps) {
  const table = String(ref.params.table ?? "") as TableName;
  const cat = useCatalog({ paused });
  if (isLoading(cat)) return <Shell><Loading /></Shell>;
  if (cat.isError) return <Shell><ErrorState message={errorText(cat) ?? ""} /></Shell>;
  const info = tableInfoOf(cat.data, table);
  if (!info) return <Shell><Gone what={`Table "${table}"`} /></Shell>;

  const out = [...new Set(info.columns.filter((c) => c.references).map((c) => c.references!.table))];
  const inn = [...new Set(info.referencedBy.map((r) => r.table))].filter((t) => t !== table);
  const boxH = (t: TableName) => HEAD + Math.min(5, tableInfoOf(cat.data, t)?.columns.length ?? 0) * LINE + 8;
  const stack = (names: TableName[]) => { let y = 8; return names.map((n) => { const p = { n, y, h: boxH(n) }; y += p.h + GAPY; return p; }); };
  const L = stack(out), R = stack(inn);
  const centerH = boxH(table);
  const H = Math.max(L.at(-1) ? L.at(-1)!.y + L.at(-1)!.h + 8 : 0, R.at(-1) ? R.at(-1)!.y + R.at(-1)!.h + 8 : 0, centerH + 16);
  const cy = (H - centerH) / 2;
  const W = BW * 3 + 80, cx = BW + 40;

  const box = (t: TableName, x: number, y: number, h: number, current = false) => {
    const ti = tableInfoOf(cat.data, t);
    return (
      <g key={t + x} transform={`translate(${x},${y})`} style={{ cursor: current ? "default" : "pointer" }} onClick={() => !current && openBeside(erRef(t))}>
        <rect width={BW} height={h} rx={6} fill="#fff" stroke={current ? "#5A2AFA" : "#D4D4D8"} strokeWidth={current ? 1.5 : 1} />
        <rect width={BW} height={HEAD} rx={6} fill={current ? "#F1EDFF" : "#FAFAFA"} />
        <text x={8} y={15} style={{ fill: "#18181B", fontFamily: "IBM Plex Sans", fontSize: 12, fontWeight: 500 }}>{t}</text>
        {(ti?.columns ?? []).slice(0, 5).map((c, i) => <text key={c.name} x={8} y={HEAD + 13 + i * LINE}>{c.primaryKey ? "◆ " : c.references ? "→ " : "  "}{c.name}</text>)}
      </g>
    );
  };
  const link = (x1: number, y1: number, x2: number, y2: number, key: string) => <path key={key} d={`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`} fill="none" stroke="#A1A1AA" strokeWidth={1} />;

  return (
    <Shell>
      <div className="pk-bar"><span className="grow pk-meta">{out.length} referenced · {inn.length} referencing. Click a table to re-centre.</span></div>
      <div className="pk-chart" style={{ overflow: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Relations around ${table}`} style={{ maxWidth: W * 1.4 }}>
          <style>{`.er text{font-family:"IBM Plex Mono",monospace;font-size:10px;fill:#71717A}`}</style>
          <g className="er">
            {L.map((p) => link(BW, p.y + p.h / 2, cx, cy + centerH / 2, "l" + p.n))}
            {R.map((p) => link(cx + BW, cy + centerH / 2, BW * 2 + 80, p.y + p.h / 2, "r" + p.n))}
            {L.map((p) => box(p.n, 0, p.y, p.h))}
            {box(table, cx, cy, centerH, true)}
            {R.map((p) => box(p.n, BW * 2 + 80, p.y, p.h))}
          </g>
        </svg>
        {out.length + inn.length === 0 && <div className="pk-meta">This table has no relations.</div>}
      </div>
    </Shell>
  );
}
