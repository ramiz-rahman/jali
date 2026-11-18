import { FileText } from "lucide-react";
import { definePaneKind } from "@jali/react";
import { copyRaw } from "../shared/copyRaw";
import { useEffect, useRef, useState } from "react";
import type { ColumnInfo, Relation, Row, TableName } from "../../data/types";
import { errorText, isLoading, useTableInfo, useRecord, useRelations, useUpdateRow } from "../../data/hooks";
import { cellKind, columnLabel, formatCell, formatCount, formatJson, rawText, isNumericType } from "../format";
import { foreignKeyRef, relationRef, singular, tableOf, tableRef } from "../shared/refs";
import { ErrorState, Loading, NullChip, Shell } from "../shared/states";
import { PaneGate } from "../shared/PaneGate";
import type { PaneComponentProps } from "@jali/react";

export function RecordPane({ ref, paused, openBeside, setActivity }: PaneComponentProps) {
  const table = tableOf(ref);
  const id = String(ref.params.id ?? "");
  const cat = useTableInfo(table, paused);
  const rec = useRecord(table, id, { paused });
  const info = cat.data;
  const update = useUpdateRow();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { setActivity(update.isPending ? "working" : isLoading(rec) ? "loading" : rec.isError || update.error ? "error" : "idle"); }, [setActivity, update.isPending, rec, update.error]);

  if (isLoading(cat) || isLoading(rec) || cat.isError || rec.isError || !info || !rec.data) {
    const gone = !info ? `Table "${table}"` : !rec.data ? `${singular(table)} ${id}` : undefined;
    return <PaneGate queries={[cat, rec]} gone={gone} onRetry={() => { void rec.refetch(); }} />;
  }
  const row = rec.data;

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
      {/* Content contract: fields sit at the record's measure from the pane's start edge; two columns when wide. */}
      <div className="pk-rec rec"><div className="rec-body">
        <div className="rec-fields">
        {info.columns.map((c) => {
          const v = row[c.name] ?? null;
          const link = foreignKeyRef(c, v);
          const canEdit = isEditable(c);
          const num = typeof v === "number";
          const kind = cellKind(v, c);
          const raw = rawText(v);
          return (
            <div className="pk-field" key={c.name}>
              <div className="k" title={`${c.name} (${c.type})`}>{columnLabel(c.name, c.format)}{c.primaryKey && <> <span className="pk-chip key">PK</span></>}</div>
              <div className={`${num ? "num" : ""}${kind === "money" ? " money" : ""}`} title={v === null || kind === "text" ? undefined : raw} data-raw={v === null ? undefined : raw} onCopy={e => copyRaw(e, true)}>
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
        </div>
        <Relations table={table} id={id} row={row} paused={paused} openBeside={openBeside} />
      </div></div>
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

function Relations({ table, id, row, paused, openBeside }: { table: TableName; id: string; row: Row; paused: boolean; openBeside: PaneComponentProps["openBeside"] }) {
  const rels = useRelations(table, id, row, { paused });
  const list = rels.data ?? [];
  return (
    <>
      <div className="pk-sec">Related records</div>
      {isLoading(rels) ? <Loading /> : rels.isError ? <ErrorState message={errorText(rels) ?? ""} /> :
        list.length === 0 ? <div className="pk-meta" style={{ padding: "4px 14px" }}>Nothing points here.</div> :
        <div className="rec-related">{list.map((r) => <RelationLink key={r.label + r.table} rel={r} openBeside={openBeside} />)}</div>}
    </>
  );
}

function RelationLink({ rel, openBeside }: { rel: Relation; openBeside: PaneComponentProps["openBeside"] }) {
  return (
    <div className="pk-field" style={{ minHeight: 28 }}>
      <button className="pk-link" style={{ textAlign: "left" }} onClick={() => openBeside(relationRef(rel))}>{rel.label}</button>
      <span className="pk-mono pk-meta">{formatCount(rel.count)}</span>
    </div>
  );
}


export const recordKind = definePaneKind({
  kind: "record", object: "record", ref: (params) => ({ kind: "record", params }),
  title: (ref) => `${singular(String(ref.params.table ?? "record"))} ${ref.params.id ?? ""}`.trim(), minWidth: 360, comfortableWidth: 440, maxWidth: 600, minHeight: 240, 
  icon: FileText, Component: RecordPane,
});

/** Which text columns can be edited inline: text-like, not keys. */
export function isEditable(c: ColumnInfo): boolean {
  return !c.primaryKey && !c.references && !isNumericType(c.type) && c.format !== "json" && !/_at$/.test(c.name) && c.name !== "email_verified";
}

