/** A review view's frame and blocks: the scrolling view, its head, sections, fact lists and tables. */
import type { ReactNode } from "react";
import { Shell } from "@jali-examples/shared/panes/shared/states";
import type { Status } from "../../model/statuses";
import { StatusMark } from "./marks";

/** A view: scrolls, and sizes its layout to its own width (container queries), not the window's. */
export function View({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Shell>
      <div className="rv" aria-label={label}>
        {children}
      </div>
    </Shell>
  );
}

/** The view's own head: what this is (`kicker`), its name, a line under it, and its status. */
export function ViewHead({
  kicker,
  title,
  status,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  status?: Status;
  children?: ReactNode;
}) {
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

/** The main column and the side column of a record view. */
export function Columns({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="rv-body">
      <div className="rv-main">{main}</div>
      <aside className="rv-side">{side}</aside>
    </div>
  );
}

/** A titled section of a view. */
export function Section({
  title,
  children,
  aside,
}: {
  title?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rv-sec">
      {title ? (
        <div className="rv-sec-head">
          <h4>{title}</h4>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** What stands in for a block until its data loads. */
export const Pending = () => <span className="rv-muted">…</span>;

export type Fact = [label: string, value: ReactNode, note?: ReactNode];
/** Label and value close together; two or three columns when the view is wide, one when narrow. */
export function Facts({ rows, cols }: { rows: Fact[]; cols?: 1 | 2 }) {
  return (
    <dl className="rv-facts" data-cols={cols}>
      {rows.map(([k, v, note]) => (
        <div key={k} className="rv-fact">
          <dt>{k}</dt>
          <dd>
            <span className="rv-val">{v}</span>
            {note ? <span className="rv-note">{note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A reviewer's table. Each column has a priority: 1 always shows; 2 and 3 drop as the view narrows (container
 * queries in layout.css), and what a dropped column says as `brief` moves under the first cell's line, so nothing is
 * lost.
 */
export interface Col<T> {
  key: string;
  head: string;
  pri: 1 | 2 | 3;
  num?: boolean;
  cell: (row: T) => ReactNode;
  /** What the column says under the first cell while it is dropped; nothing, when the row has nothing to say. */
  brief?: (row: T) => ReactNode;
}

/** A row of a table: keyed by its `id`, coloured by its `status` (`data-status`) when it has one. */
interface TableRow {
  id: number;
  status?: string;
}

export function Table<T extends TableRow>({
  cols,
  rows,
  label,
}: {
  cols: Col<T>[];
  rows: T[];
  label: string;
}) {
  const droppable = cols.filter((c) => c.pri > 1 && c.brief);
  return (
    <table className="rv-table" aria-label={label}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c.key} scope="col" data-pri={c.pri} className={c.num ? "num" : undefined}>
              {c.head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} data-status={r.status}>
            {cols.map((c, i) => (
              <td key={c.key} data-pri={c.pri} className={c.num ? "num" : undefined}>
                {c.cell(r)}
                {i === 0 ? <Brief row={r} cols={droppable} /> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** What the dropped columns say about a row, under its first cell; each goes when its column is back. */
function Brief<T>({ row, cols }: { row: T; cols: Col<T>[] }) {
  const said = cols.map((c) => ({ c, node: c.brief!(row) })).filter(({ node }) => node);
  return said.length ? (
    <div className="rv-stack">
      {said.map(({ c, node }) => (
        <span key={c.key} data-pri={c.pri}>
          {node}
        </span>
      ))}
    </div>
  ) : null;
}
