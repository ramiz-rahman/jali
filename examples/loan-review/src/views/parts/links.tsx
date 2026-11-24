/**
 * Links to related records and lists. They open with the pane's own link action (`usePane().openBeside`): a peek in
 * Single, beside in Split view. `data-ref` names what a link opens, for tests and tools.
 */
import type { ReactNode } from "react";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import type { ObjectRef } from "jali-layout";
import { useJaliState, usePane } from "jali-layout/react";
import { useBookRecord } from "../../data";
import type { BookRows } from "../../model/rows";
import { counted, pluralOf } from "../../model/words";
import { recordRef, refKey, TABLES, type ListRef } from "../../nav/refs";
import { role } from "../../role";
import { Avatar } from "./marks";

/** How a link is followed here: a peek in Single view and for a processor (role.tsx), beside in Split view. */
function useLinkVerb() {
  const peeks = role() === "processor";
  return useJaliState((s) => (s.page && (s.page.mode === "single" || peeks) ? "peek" : "beside"));
}

/** A link to `to`, named `name` in its tooltip ("Peek at …", "Open … beside"). */
export function RefLink({
  to,
  children,
  className = "rv-link",
  name,
}: {
  to: ObjectRef;
  children: ReactNode;
  className?: string;
  name: string;
}) {
  const { openBeside } = usePane();
  const verb = useLinkVerb();
  return (
    <button
      type="button"
      className={className}
      data-ref={refKey(to)}
      onClick={() => openBeside(to)}
      title={verb === "peek" ? `Peek at ${name}` : `Open ${name} beside`}
    >
      {children}
    </button>
  );
}

/** A list of related things (RecordLink, CountLink). */
export const RelatedList = ({ children }: { children: ReactNode }) => (
  <ul className="rv-rels">{children}</ul>
);

/** One line in a list of related things: what it is, a note, and the way to open it. No `to`: plain text. */
function Related({
  to,
  label,
  note,
  icon,
  name,
}: {
  to?: ObjectRef;
  label: ReactNode;
  note?: ReactNode;
  icon: ReactNode;
  name: string;
}) {
  const body = (
    <>
      <span className="rv-rel-icon" aria-hidden>
        {icon}
      </span>
      <span className="rv-rel-text">
        <span className="rv-rel-label">{label}</span>
        {note ? <span className="rv-rel-note">{note}</span> : null}
      </span>
      {to ? <ArrowUpRightIcon className="rv-rel-go" size={14} aria-hidden /> : null}
    </>
  );
  return (
    <li>
      {to ? (
        <RefLink to={to} className="rv-rel" name={name}>
          {body}
        </RefLink>
      ) : (
        <div className="rv-rel is-static">{body}</div>
      )}
    </li>
  );
}

type Named = "borrowers" | "properties" | "loan_officers";

/** What a linked record is called: a person by name, a home by its street address. */
const called = (row: BookRows[Named]) => ("name" in row ? row.name : row.address);

/**
 * A link to a borrower, property or officer by id: it reads the record itself, and names it once it loads (until
 * then, the table's word for it). `note` says what it is to this view; `avatar` shows initials instead of the icon.
 */
export function RecordLink<T extends Named>({
  table,
  id,
  note,
  avatar,
}: {
  table: T;
  id: number;
  note?: (row: BookRows[T] | undefined) => ReactNode;
  avatar?: boolean;
}) {
  const row = useBookRecord(table, id);
  const { icon: Icon, noun } = TABLES[table];
  const name = row && called(row);
  return (
    <Related
      to={recordRef(table, id)}
      name={name ?? `the ${noun.toLowerCase()}`}
      icon={avatar ? <Avatar name={name} /> : <Icon size={15} />}
      label={name ?? noun}
      note={note?.(row)}
    />
  );
}

/**
 * A link to a list (`to`: listRef) as a count in words: "Three applications". It links only when there is something
 * to see, `count` above zero. Until the count loads it reads the noun's plural: "Applications".
 */
export function CountLink({
  to,
  count,
  noun,
  label,
  note,
}: {
  to: ListRef;
  count: number | undefined;
  /** What one row is: "mortgage", "other application". */
  noun: string;
  /** Says it in other words than the count. */
  label?: ReactNode;
  note?: ReactNode;
}) {
  const Icon = TABLES[to.params.table].icon;
  return (
    <Related
      to={count ? to : undefined}
      name={pluralOf(noun)}
      icon={<Icon size={15} />}
      label={label ?? counted(count, noun)}
      note={note}
    />
  );
}
