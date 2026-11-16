import { useEffect, useRef, useState } from "react";
import type { ColumnInfo, Relation, Row, TableName } from "../data/types";
import { errorText, isLoading, useCatalog, useRecord, useRelations, useRows, useUpdateRow } from "./data";
import { cellKind, columnLabel, foreignKeyRef, formatCell, formatCount, formatJson, rawText, isEditable, relationRef, singular, tableInfoOf, tableRef } from "./format";
import { ErrorState, Gone, Loading, NullChip, Shell } from "./states";
import type { PaneProps } from "./props";

export function RecordPane({ ref, paused, openBeside, setActivity }: PaneProps) {
  const table = String(ref.params.table ?? "") as TableName;
  const id = String(ref.params.id ?? "");
  const cat = useCatalog({ paused });
  const rec = useRecord(table, id, { paused });
  const info = tableInfoOf(cat.data, table);
  const update = useUpdateRow();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { setActivity(update.isPending ? "working" : isLoading(rec) ? "loading" : rec.isError || update.error ? "error" : "idle"); }, [setActivity, update.isPending, rec, update.error]);

  if (isLoading(cat) || isLoading(rec)) return <Shell><Loading /></Shell>;
  if (cat.isError || rec.isError) return <Shell><ErrorState message={errorText(cat) ?? errorText(rec) ?? ""} onRetry={() => { void rec.refetch(); }} /></Shell>;
  if (!info) return <Shell><Gone what={`Table "${table}"`} /></Shell>;
  const row = rec.data;
  if (!row) return <Shell><Gone what={`${singular(table)} ${id}`} /></Shell>;

  const heading = String(row.name ?? row.title ?? row.email ?? `${singular(table)} ${id}`);
  const commit = (c: ColumnInfo) => {
    const next = draft;
    setEditing(null);
    if (next === (row[c.name] ?? "")) return;
    setSaveError(null);
    update.mutate({ table, id, patch: { [c.name]: next } }, { onError: (e) => setSaveError(e instanceof Error ? e.message : String(e)) });
  };

  return (
    <Shell>
      <div className="pk-bar">
        <div className="grow"><div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{heading}</div>
          <div className="pk-meta"><button className="pk-link" onClick={() => openBeside(tableRef(table))}>{table}</button> · <span className="pk-mono">{id}</span></div></div>
        {update.isPending && <span className="pk-meta">Saving</span>}
      </div>
      {saveError && <div role="alert" className="pk-meta" style={{ padding: "6px 14px", color: "var(--red, #B42318)" }}>Could not save: {saveError}</div>}
      <div className="pk-rec">
        {info.columns.map((c) => {
          const v = row[c.name] ?? null;
          const link = foreignKeyRef(c, v);
          const canEdit = isEditable(c);
          const num = typeof v === "number";
          const kind = cellKind(v, c);
          const raw = rawText(v);
          return (
            <div className="pk-field" key={c.name}>
              <div className="k" title={`${c.name} (${c.type})`}>{columnLabel(c.name)}{c.primaryKey && <> <span className="pk-chip key">PK</span></>}</div>
              <div className={`${num ? "num" : ""}${kind === "money" ? " money" : ""}`} title={v === null || kind === "text" ? undefined : raw} data-raw={v === null ? undefined : raw} onCopy={(e) => { if (v !== null && window.getSelection()?.toString() === formatCell(v, c)) { e.clipboardData.setData("text/plain", raw); e.preventDefault(); } }}>
                {editing === c.name ? (
                  <input className="pk-edit" autoFocus value={draft} aria-label={c.name} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(c)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(c); if (e.key === "Escape") { e.preventDefault(); setEditing(null); } }} />
                ) : link ? <button className="pk-link num" onClick={() => openBeside(link)} title={`Open ${link.params.table} ${link.params.id} beside`}>{formatCell(v, c)}</button>
                  : canEdit ? <span className="pk-val" tabIndex={0} role="button" aria-label={`Edit ${c.name}`} title="Click to edit"
                      onClick={() => { setDraft(String(v ?? "")); setEditing(c.name); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.altKey) { setDraft(String(v ?? "")); setEditing(c.name); e.preventDefault(); } }}>{v === null ? <NullChip /> : formatCell(v, c)}</span>
                  : kind === "json" ? <JsonValue text={String(v)} open={open.has(c.name)} toggle={() => setOpen((s) => { const n = new Set(s); if (!n.delete(c.name)) n.add(c.name); return n; })} />
                  : <span className="pk-val" style={{ cursor: "default" }}>{v === null ? <NullChip /> : formatCell(v, c)}</span>}
              </div>
            </div>
          );
        })}
        <Relations table={table} id={id} row={row} paused={paused} openBeside={openBeside} />
      </div>
    </Shell>
  );
}

const JSON_CUT = 72;
/** A JSON value: compact and monospaced, cut short, with an expander that shows it indented. */
function JsonValue({ text, open, toggle }: { text: string; open: boolean; toggle(): void }) {
  const compact = formatJson(text);
  const long = compact.length > JSON_CUT || compact.includes("\n");
  return (
    <div className="pk-json">
      {open ? <pre>{formatJson(text, true)}</pre> : <code>{long ? `${compact.slice(0, JSON_CUT)}…` : compact}</code>}
      {long && <button className="pk-link" aria-expanded={open} onClick={toggle}>{open ? "Collapse" : "Expand"}</button>}
    </div>
  );
}

function Relations({ table, id, row, paused, openBeside }: { table: TableName; id: string; row: Row; paused: boolean; openBeside: PaneProps["openBeside"] }) {
  const rels = useRelations(table, id, row, { paused });
  const list = rels.data ?? [];
  return (
    <>
      <div className="pk-sec">Related records</div>
      {isLoading(rels) ? <Loading /> : rels.isError ? <ErrorState message={errorText(rels) ?? ""} /> :
        list.length === 0 ? <div className="pk-meta" style={{ padding: "4px 14px" }}>Nothing points here.</div> :
        list.map((r) => <RelationLink key={r.label + r.table} rel={r} paused={paused} openBeside={openBeside} />)}
    </>
  );
}

function RelationLink({ rel, paused, openBeside }: { rel: Relation; paused: boolean; openBeside: PaneProps["openBeside"] }) {
  const count = useRows(rel.table, { where: rel.where, limit: 1 }, { paused });
  return (
    <div className="pk-field" style={{ minHeight: 28 }}>
      <button className="pk-link" style={{ textAlign: "left" }} onClick={() => openBeside(relationRef(rel))}>{rel.label}</button>
      <span className="pk-mono pk-meta">{count.data ? formatCount(count.data.total) : ""}</span>
    </div>
  );
}
