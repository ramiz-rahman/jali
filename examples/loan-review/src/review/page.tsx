/** The loan-review page around the panes: the queue at the left and the application's header above the tabs. */
import { useEffect, useMemo, useRef, useState } from "react";
import { FunnelSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useJali } from "@jali/react";
import { isLoading, useRows } from "#shared/data/hooks";
import { formatTimestamp } from "#shared/panes/format";
import type { Row } from "#shared/data/types";
import { applicationFacts } from "#shared/data/sample-sql";
import "#shared/panes/panes.css";
import "./review.css";

const STATUS_ORDER: Record<string, number> = { pending: 0, returned: 1, approved: 2 };
export const taka = (cents: unknown) =>
  `৳${Math.round(Number(cents) / 100).toLocaleString("en-US")}`;
export const day = (v: unknown) => formatTimestamp(v)?.replace(/, \d.*$/, "") ?? String(v ?? "");

/** One application, its borrower, group and officer: what the header and Overview read. */
export function useApplication(item: number, paused = false) {
  const f = applicationFacts(item);
  const app = useRows("loan_applications", { where: { id: item }, limit: 1 }, { paused });
  const member = useRows("members", { where: { id: f.member }, limit: 1 }, { paused });
  const group = useRows("lending_groups", { where: { id: f.group }, limit: 1 }, { paused });
  const officer = useRows("field_officers", { where: { id: f.officer }, limit: 1 }, { paused });
  const loans = useRows(
    "loans",
    { where: { member_id: f.member }, orderBy: "cycle DESC", limit: 20 },
    { paused },
  );
  return {
    facts: f,
    app: app.data?.rows[0],
    member: member.data?.rows[0],
    group: group.data?.rows[0],
    officer: officer.data?.rows[0],
    loans: loans.data?.rows,
    loading: [app, member].some(isLoading),
  };
}

/**
 * The queue: applications waiting first. J/K or the arrows move through it while it has focus (character keys are
 * scoped to focus, WCAG 2.1.4, so a grid's J/K in a view never moves the queue); F6 reaches it (`data-pane-region`).
 * Choosing one makes it the page's item.
 */
export function QueueRail({ item, activate }: { item: number; activate: (item: number) => void }) {
  const apps = useRows("loan_applications", { orderBy: "id ASC", limit: 200 });
  const members = useRows("members", { orderBy: "id ASC", limit: 400 });
  const list = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      [...(apps.data?.rows ?? [])].sort(
        (a, b) =>
          (STATUS_ORDER[String(a.status)] ?? 9) - (STATUS_ORDER[String(b.status)] ?? 9) ||
          Number(a.id) - Number(b.id),
      ),
    [apps.data],
  );
  const names = useMemo(
    () => new Map((members.data?.rows ?? []).map((m: Row) => [Number(m.id), String(m.name)])),
    [members.data],
  );
  const at = rows.findIndex((r) => Number(r.id) === item);
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[aria-selected=true]");
    el?.scrollIntoView({ block: "nearest" });
    if (list.current?.contains(document.activeElement)) el?.focus({ preventScroll: true });
  }, [at]);
  const pending = rows.filter((r) => r.status === "pending").length;
  const go = (i: number) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (r) activate(Number(r.id));
  };
  return (
    <aside className="rail" aria-label="Queue">
      <div className="rail-head">
        <b>Applications</b>
        <span className="pk-meta">
          <span className="pk-mono">{pending}</span> waiting · J/K when focused
        </span>
      </div>
      <div
        className="rq-list"
        role="listbox"
        aria-label="Loan applications"
        ref={list}
        data-pane-region="queue"
        onKeyDown={(e) => {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          if (e.key === "j" || e.key === "ArrowDown") {
            e.preventDefault();
            go(at + 1);
          } else if (e.key === "k" || e.key === "ArrowUp") {
            e.preventDefault();
            go(at - 1);
          }
        }}
      >
        {rows.map((r) => {
          const id = Number(r.id),
            selected = id === item;
          return (
            <div
              key={id}
              role="option"
              aria-selected={selected}
              tabIndex={selected || (at < 0 && id === Number(rows[0]!.id)) ? 0 : -1}
              className="rq-item"
              data-status={String(r.status)}
              onClick={() => activate(id)}
            >
              <div className="rq-line">
                <span className="rq-name">
                  {names.get(Number(r.member_id)) ?? `Member ${r.member_id}`}
                </span>
                <span className="rq-amount pk-mono">{taka(r.amount_cents)}</span>
              </div>
              <div className="rq-line pk-meta">
                <span>
                  #{id} · {String(r.product)}
                </span>
                <span className="rq-status">
                  {r.status === "pending" ? day(r.submitted_at) : String(r.status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/** Phones have no rail: a "N waiting" button in the header opens the queue as a sheet. Hidden from 768px up. */
function QueueSheet({ item }: { item: number }) {
  const { actions } = useJali();
  const apps = useRows("loan_applications", { orderBy: "id ASC", limit: 200 });
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const waiting = (apps.data?.rows ?? []).filter((r: Row) => r.status === "pending").length;
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  return (
    <>
      <button
        ref={btn}
        className="item-queue"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <FunnelSimpleIcon size={14} aria-hidden /> <span className="pk-mono">{waiting}</span>{" "}
        waiting
      </button>
      {open ? (
        <div
          className="queue-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Queue"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <button
            className="jali-icon-btn queue-sheet-close"
            aria-label="Close queue"
            onClick={close}
            autoFocus
          >
            <XIcon size={16} aria-hidden />
          </button>
          <QueueRail
            item={item}
            activate={(i) => {
              actions.activate(i);
              close();
            }}
          />
        </div>
      ) : null}
    </>
  );
}

/** The application's header: who is asking, for what, and the facts a reviewer checks first, in one strip. */
export function ApplicationHeader({ item }: { item: number }) {
  const { app, member, group, officer } = useApplication(item);
  const name = member ? String(member.name) : "…";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
  const status = app ? String(app.status) : "";
  const facts: [string, string, string?][] = app
    ? [
        [
          "Amount",
          taka(app.amount_cents),
          `${app.term_weeks} weeks · ${taka(Number(app.amount_cents) / Number(app.term_weeks))} a week`,
        ],
        ["Product", String(app.product), String(app.purpose)],
        [
          "Group",
          group ? String(group.name) : "…",
          group ? `${group.village} · meets ${group.meeting_day}` : undefined,
        ],
        [
          "Field officer",
          officer ? String(officer.name) : "…",
          officer ? `${officer.branch} branch` : undefined,
        ],
        [
          "Savings",
          member ? taka(member.savings_cents) : "…",
          member ? `member since ${day(member.joined_on)}` : undefined,
        ],
      ]
    : [];
  return (
    <section className="item-head" aria-label={`Application ${item}`}>
      <div className="item-id">
        <span className="item-avatar" aria-hidden>
          {initials}
        </span>
        <div className="item-name">
          <div className="item-kicker">
            Loan application <span className="pk-mono">#{item}</span>
            {app ? <> · submitted {day(app.submitted_at)}</> : null}
          </div>
          <h1>{name}</h1>
        </div>
        <QueueSheet item={item} />
        {status ? (
          <span className="item-status" data-status={status}>
            {status === "pending"
              ? "Waiting for review"
              : status === "returned"
                ? "Returned"
                : "Approved"}
          </span>
        ) : null}
      </div>
      <dl className="item-facts">
        {facts.map(([k, v, sub]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
            {sub ? <dd className="pk-meta">{sub}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
