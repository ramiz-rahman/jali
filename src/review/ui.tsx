/** The loan-review views' parts: a view with its own head, fact lists, links to related records, status marks, tables. */
import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Check, Info, OctagonAlert } from "lucide-react";
import type { ObjectRef } from "@jali/core";
import type { Row } from "../data/types";
import type { PaneComponentProps } from "@jali/react";
import { useUi } from "@jali/react";
import { Shell } from "../panes/shared/states";
import { statusLabel } from "./data";
import type { Tone } from "./signals";
import "./views.css";

/** Refs the review views open: the same kinds as the tabs, so a peek or an opened pane is a designed view too. */
export const recordRef = (table: string, id: unknown): ObjectRef => ({ kind: "review-record", params: { table, id: Number(id) } });
export const listRef = (table: string, column: string, value: unknown, label: string): ObjectRef =>
  ({ kind: "review-related", params: { table, column, value: Number(value), label } });

/** A view: scrolls, and sizes its layout to its own width (container queries), not the window's. */
export function View({ children, label }: { children: ReactNode; label?: string }) {
  return <Shell><div className="rv" aria-label={label}>{children}</div></Shell>;
}

export function ViewHead({ kicker, title, status, children }: { kicker?: ReactNode; title: ReactNode; status?: unknown; children?: ReactNode }) {
  return (
    <header className="rv-head">
      <div className="rv-head-text">
        {kicker ? <div className="rv-kicker">{kicker}</div> : null}
        <h3 className="rv-title">{title}</h3>
        {children ? <div className="rv-sub">{children}</div> : null}
      </div>
      {status !== undefined ? <StatusMark status={status} /> : null}
    </header>
  );
}

export function Sec({ title, children, aside, className }: { title?: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`rv-sec${className ? ` ${className}` : ""}`} aria-label={title}>
      {title ? <div className="rv-sec-head"><h4>{title}</h4>{aside}</div> : null}
      {children}
    </section>
  );
}

export type Fact = [label: string, value: ReactNode, note?: ReactNode];
/** Label and value close together; two or three columns when the view is wide, one when narrow. */
export function Facts({ rows, cols }: { rows: (Fact | null | false)[]; cols?: 1 | 2 }) {
  return (
    <dl className="rv-facts" data-cols={cols}>
      {rows.filter((r): r is Fact => !!r).map(([k, v, note]) => (
        <div key={k} className="rv-fact"><dt>{k}</dt><dd><span className="rv-val">{v}</span>{note ? <span className="rv-note">{note}</span> : null}</dd></div>
      ))}
    </dl>
  );
}

/** How a link is followed here: a peek in Single (and for roles that only peek), beside in Multiplexed. */
function useLinkVerb() {
  return useUi((s) => (s.review && (s.review.mode === "single" || !s.review.canInvestigate) ? "peek" : "beside"));
}

/** A related record or list, opened with the pane's own link action. `data-ref` names the object for tests and tools. */
export function RefLink({ to, open, children, className = "rv-link", name }: { to: ObjectRef; open: PaneComponentProps["openBeside"]; children: ReactNode; className?: string; name: string }) {
  const verb = useLinkVerb();
  const key = to.kind === "review-record" ? `${to.params.table} ${to.params.id}` : `${to.params.table} ${to.params.column}=${to.params.value}`;
  return (
    <button type="button" className={className} data-ref={key} onClick={() => open(to)}
      title={verb === "peek" ? `Peek at ${name}` : `Open ${name} beside`}>
      {children}
    </button>
  );
}

/** One line in a list of related things: what it is, a note, and the way to open it. A zero count is plain text. */
export function Related({ to, open, label, note, icon, name }: { to?: ObjectRef; open: PaneComponentProps["openBeside"]; label: ReactNode; note?: ReactNode; icon?: ReactNode; name: string }) {
  const body = (
    <>
      {icon ? <span className="rv-rel-icon" aria-hidden>{icon}</span> : null}
      <span className="rv-rel-text"><span className="rv-rel-label">{label}</span>{note ? <span className="rv-rel-note">{note}</span> : null}</span>
      {to ? <ArrowUpRight className="rv-rel-go" size={14} strokeWidth={1.75} aria-hidden /> : null}
    </>
  );
  return <li>{to ? <RefLink to={to} open={open} className="rv-rel" name={name}>{body}</RefLink> : <div className="rv-rel is-static">{body}</div>}</li>;
}
export const RelatedList = ({ children }: { children: ReactNode }) => <ul className="rv-rels">{children}</ul>;

export const initials = (name: unknown) => String(name ?? "").split(" ").map((w) => w[0]).join("").slice(0, 2);
export const Avatar = ({ name }: { name: unknown }) => <span className="rv-avatar">{initials(name)}</span>;

/** A status as a reader says it, coloured by what it asks of them. */
export function StatusMark({ status }: { status: unknown }) {
  const s = String(status);
  return <span className="rv-status" data-status={s}>{s === "overdue" ? <AlertTriangle size={12} strokeWidth={2} aria-hidden /> : null}{statusLabel(s)}</span>;
}

const TONE_ICON: Record<Tone, ReactNode> = {
  ok: <Check size={14} strokeWidth={2} aria-hidden />,
  info: <Info size={14} strokeWidth={1.75} aria-hidden />,
  warn: <AlertTriangle size={14} strokeWidth={1.75} aria-hidden />,
  risk: <OctagonAlert size={14} strokeWidth={1.75} aria-hidden />,
};
export const ToneIcon = ({ tone }: { tone: Tone }) => <span className="rv-tone" data-tone={tone}>{TONE_ICON[tone]}</span>;

/** Instalments as marks, oldest first: filled on time, amber late, red ring missed. */
export function Instalments({ rows }: { rows: Row[] | undefined }) {
  if (!rows) return <span className="rv-dots is-loading" aria-hidden />;
  const label = `${rows.filter((r) => r.status === "on time").length} of ${rows.length} instalments on time`;
  return (
    <span className="rv-dots" role="img" aria-label={label} title={label}>
      {rows.map((r, i) => <i key={i} data-status={String(r.status)} />)}
    </span>
  );
}

/**
 * A reviewer's table. Each column has a priority: 1 always shows; 2 and 3 drop as the view narrows (container
 * queries in views.css), and what they said moves under the first cell's line (`stack`) so nothing is lost.
 */
export interface Col<T> { key: string; head: string; pri: 1 | 2 | 3; num?: boolean; cell: (row: T) => ReactNode }
export function Table<T>({ cols, rows, rowKey, label, stack, rowAttrs }: {
  cols: Col<T>[]; rows: T[]; rowKey: (row: T) => string; label: string;
  stack?: (row: T) => [pri: 2 | 3, node: ReactNode][]; rowAttrs?: (row: T) => Record<string, string>;
}) {
  return (
    <table className="rv-table" aria-label={label}>
      <thead><tr>{cols.map((c) => <th key={c.key} scope="col" data-pri={c.pri} className={c.num ? "num" : undefined}>{c.head}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={rowKey(r)} {...rowAttrs?.(r)}>
            {cols.map((c, i) => (
              <td key={c.key} data-pri={c.pri} className={c.num ? "num" : undefined}>
                {c.cell(r)}
                {i === 0 && stack ? <div className="rv-stack">{stack(r).filter(([, node]) => node !== "" && node != null).map(([pri, node], k) => <span key={k} data-pri={pri}>{node}</span>)}</div> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
