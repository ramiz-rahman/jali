import { TerminalSquare } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { useEffect, useRef, useState } from "react";
import { resultFormat } from "../../data/labels";
import type { ResultHandle, Row } from "../../data/types";
import { Grid, type GridColumn } from "../grid/Grid";
import { errorText, useRun } from "../../data/hooks";
import { formatCount, formatMs } from "../format";
import { chartRef } from "../shared/refs";
import { Empty, ErrorState, Loading, Shell } from "../shared/states";
import { useResultWindow } from "../grid/useWindow";
import type { PaneComponentProps } from "../../ui/pane-kinds";
import { keyHint } from "../../ui/commands/format";
import { usePaneState } from "../../ui/pane/usePaneState";

export const DEFAULT_SQL = "SELECT region, SUM(amount_cents) AS amount_cents\nFROM sample_orders\nGROUP BY region\nORDER BY amount_cents DESC";

export function QueryPane({ ref, paused, focused, openBeside, setActivity, setUnsaved, setCommands }: PaneComponentProps) {
  const start = typeof ref.params.sql === "string" ? ref.params.sql : DEFAULT_SQL;
  // The draft is the pane's own state: it outlives a fold, a tab switch and a reload.
  const [sql, setSql] = usePaneState("sql", start);
  const [ran, setRan] = usePaneState("ran", start);
  const [handle, setHandle] = useState<ResultHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useRun();

  useEffect(() => { setActivity(run.isPending ? "working" : error ? "error" : "idle"); }, [setActivity, run.isPending, error]);

  const exec = (andChart = false) => {
    setError(null);
    setRan(sql);
    run.mutate(sql, {
      onSuccess: (h) => {
        setHandle(h);
        if (andChart) openBeside(chartRef(h.runId));
      },
      onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    });
  };

  // An edit that has not run is work the person would lose by closing the pane.
  const edited = sql.trim() !== ran.trim();
  useEffect(() => { setUnsaved(edited ? "an edited query that has not run" : null); }, [setUnsaved, edited]);
  useEffect(() => () => setUnsaved(null), [setUnsaved]);

  // ⌘K lists what this pane can do while it is focused.
  const latest = useRef({ exec, handle });
  latest.current = { exec, handle };
  const busy = run.isPending, empty = !sql.trim(), hasResult = !!handle;
  useEffect(() => {
    setCommands([
      { id: "run", title: "Run query", keys: keyHint("Mod+Enter"), disabled: busy ? "Already running" : empty ? "The query is empty" : false, run: () => latest.current.exec() },
      { id: "chart", title: "Chart this result", disabled: hasResult ? false : "Run the query first", run: () => { const h = latest.current.handle; if (h) openBeside(chartRef(h.runId)); } },
    ]);
  }, [setCommands, openBeside, busy, empty, hasResult]);
  useEffect(() => () => setCommands(null), [setCommands]);

  // Presets can ask the query to run on load and hand its result handle to the linked chart.
  const autorun = useRef(false);
  useEffect(() => {
    if (!ref.params.autorun || autorun.current) return;
    autorun.current = true;
    exec(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell>
      <div className="pk-bar">
        <button className="pk-btn primary" onClick={() => exec()} disabled={run.isPending || !sql.trim()}>{run.isPending ? "Running" : "Run"} <span className="pk-mono" style={{ opacity: .7 }}>{keyHint("Mod+Enter")}</span></button>
        <span className="grow pk-meta">{handle && !error ? <><span className="pk-mono">{formatCount(handle.rowCount)}</span> rows in <span className="pk-mono">{formatMs(handle.ms)}</span></> : "SQL"}</span>
        <button className="pk-btn" disabled={!handle} onClick={() => handle && openBeside(chartRef(handle.runId))}>Chart this result</button>
      </div>
      <textarea className="pk-sql" value={sql} spellCheck={false} aria-label="SQL" onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); exec(); } }} />
      <div className="pk-split" />
      {error ? <ErrorState message={error} /> : run.isPending && !handle ? <Loading /> : handle ? <ResultGrid handle={handle} paused={paused} focused={focused} /> : <Empty title="No results yet" hint={`Press ${keyHint("Mod+Enter")} to run the query.`} />}
    </Shell>
  );
}

function ResultGrid({ handle, paused, focused }: { handle: ResultHandle; paused: boolean; focused: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const w = useResultWindow(handle.runId, handle.rowCount, paused);
  useEffect(() => { setSel(null); }, [handle.runId]);
  const rows = w.rows;
  const columns: GridColumn[] = handle.columns.map((name) => ({ name, type: typeFromRows(rows, name), format: resultFormat(name) }));
  if (w.q.isError) return <ErrorState message={errorText(w.q) ?? ""} />;
  if (!handle.rowCount) return <Empty title="No rows" hint="The query ran and matched nothing." />;
  return <Grid label="Query results" columns={columns} total={handle.rowCount} rows={rows} startOffset={w.offset} onRange={w.onRange} selected={sel} onSelect={setSel} focused={focused} />;
}

function typeFromRows(rows: Row[], name: string) {
  const v = rows.find((r) => r[name] !== null && r[name] !== undefined)?.[name];
  return typeof v === "number" ? "number" : "text";
}


export const queryKind = definePaneKind({
  kind: "query", ref: (params) => ({ kind: "query", params }),
  title: (_ref) => "Query", minWidth: 400, comfortableWidth: 560, minHeight: 280, heavy: true, identity: () => undefined,
  icon: TerminalSquare, Component: QueryPane,
});
