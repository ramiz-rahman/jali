import { useCallback, useEffect, useRef, useState } from "react";
import type { ResultHandle, Row } from "../data/types";
import { Grid, type GridColumn } from "./Grid";
import { errorText, useResultRows, useRun } from "./data";
import { chartRef, formatCount, formatMs } from "./format";
import { Empty, ErrorState, Loading, Shell } from "./states";
import type { PaneProps } from "./props";

export const DEFAULT_SQL = "SELECT region, SUM(amount_cents) AS amount_cents\nFROM sample_orders\nGROUP BY region\nORDER BY amount_cents DESC";

export function QueryPane({ ref, paused, focused, openBeside, setActivity }: PaneProps) {
  const [sql, setSql] = useState(typeof ref.params.sql === "string" ? ref.params.sql : DEFAULT_SQL);
  const [handle, setHandle] = useState<ResultHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useRun();

  useEffect(() => { setActivity(run.isPending ? "working" : error ? "error" : "idle"); }, [setActivity, run.isPending, error]);

  const exec = (andChart = false) => {
    setError(null);
    run.mutate(sql, {
      onSuccess: (h) => {
        setHandle(h);
        if (andChart) openBeside(chartRef(h.runId));
      },
      onError: (e) => setError(e instanceof Error ? e.message : String(e)),
    });
  };

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
        <button className="pk-btn primary" onClick={() => exec()} disabled={run.isPending || !sql.trim()}>{run.isPending ? "Running" : "Run"} <span className="pk-mono" style={{ opacity: .7 }}>⌘↵</span></button>
        <span className="grow pk-meta">{handle && !error ? <><span className="pk-mono">{formatCount(handle.rowCount)}</span> rows in <span className="pk-mono">{formatMs(handle.ms)}</span></> : "SQL"}</span>
        <button className="pk-btn" disabled={!handle} onClick={() => handle && openBeside(chartRef(handle.runId))}>Chart this result</button>
      </div>
      <textarea className="pk-sql" value={sql} spellCheck={false} aria-label="SQL" onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); exec(); } }} />
      <div className="pk-split" />
      {error ? <ErrorState message={error} /> : run.isPending && !handle ? <Loading /> : handle ? <ResultGrid handle={handle} paused={paused} focused={focused} /> : <Empty title="No results yet" hint="Press ⌘↵ to run the query." />}
    </Shell>
  );
}

function ResultGrid({ handle, paused, focused }: { handle: ResultHandle; paused: boolean; focused: boolean }) {
  const [start, setStart] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const onRange = useCallback((s: number) => setStart(Math.floor(s / 100) * 100), []);
  const q = useResultRows(handle.runId, start, 200, { paused });
  useEffect(() => { setStart(0); setSel(null); }, [handle.runId]);
  const rows: Row[] = q.data ?? [];
  const columns: GridColumn[] = handle.columns.map((name) => ({ name, type: typeFromRows(rows, name) }));
  if (q.isError) return <ErrorState message={errorText(q) ?? ""} />;
  if (!handle.rowCount) return <Empty title="No rows" hint="The query ran and matched nothing." />;
  return <Grid label="Query results" columns={columns} total={handle.rowCount} rows={rows} startOffset={start} onRange={onRange} selected={sel} onSelect={setSel} focused={focused} />;
}

function typeFromRows(rows: Row[], name: string) {
  const v = rows.find((r) => r[name] !== null && r[name] !== undefined)?.[name];
  return typeof v === "number" ? "number" : "text";
}
