/**
 * The queue as a list, at the left from 768px up (on phones the header's sheet shows it: sheet.tsx). J/K or the
 * arrows move through it while it has focus (character keys are scoped to focus, WCAG 2.1.4, so a grid's J/K in a
 * view never moves the queue); F6 reaches it (`data-pane-region`). Choosing one makes it the page's item.
 *
 * Collapsed (chrome.ts), it is a slim strip: where this application sits in the queue, and the queue as a column of
 * squares, one per application (volt while it waits, the open one in ink), still a listbox that J/K and clicks move.
 * It is the same markup either way (`data-collapsed`); queue.css draws the list or the strip.
 */
import { useEffect, useRef } from "react";
import { useListKeys } from "@jali-examples/shared/panes/shared/useListKeys";
import { useBorrowerName } from "../../data";
import type { Application } from "../../model/rows";
import { APPLICATION_STATUS, isWaiting } from "../../model/statuses";
import { monthDay, purposeShort, usdShort } from "../../model/words";
import { useChrome } from "../chrome";
import { CollapseToggle } from "../collapse-toggle";
import { useQueue } from "./use-queue";

export function QueueRail({
  item,
  showItem,
  sheet = false,
}: {
  item: number;
  showItem: (item: number) => void;
  /** In the phone's sheet: always the full list, with nothing to collapse. */
  sheet?: boolean;
}) {
  const { rows, waiting } = useQueue();
  const name = useBorrowerName();
  const collapsed = useChrome().queue && !sheet;
  const list = useRef<HTMLDivElement>(null);
  const at = rows.findIndex((r) => r.id === item);
  const onKey = useListKeys(rows.length, at, (i) => showItem(rows[i]!.id));
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>("[aria-selected=true]");
    el?.scrollIntoView({ block: "nearest" });
    if (list.current?.contains(document.activeElement)) el?.focus({ preventScroll: true });
  }, [at, collapsed]);

  return (
    <aside className="rail" data-collapsed={collapsed ? "" : undefined} aria-label="Queue">
      <div className="rail-head">
        <div className="rail-title">
          <b>Underwriting queue</b>
          <span className="pk-meta">
            <span className="rail-count">{waiting}</span> in review · J/K to move
          </span>
        </div>
        {sheet ? null : (
          <CollapseToggle part="queue" collapsed={collapsed} className="rail-toggle" />
        )}
      </div>
      <div className="rail-pos" aria-hidden>
        <b>{at + 1}</b>
        <span>{rows.length}</span>
      </div>
      <div
        className={collapsed ? "rq-map" : "rq-list"}
        role="listbox"
        aria-label="Loan applications"
        ref={list}
        data-pane-region="queue"
        onKeyDown={onKey}
      >
        {rows.map((r, i) => (
          <QueueItem
            key={r.id}
            app={r}
            borrower={name(r.borrower_id)}
            compact={collapsed}
            selected={r.id === item}
            focusable={r.id === item || (at < 0 && i === 0)}
            onChoose={() => showItem(r.id)}
          />
        ))}
      </div>
    </aside>
  );
}

/**
 * One application in the queue. In the list: who, how much, the program and purpose, and when it came in or where it
 * stands. In the strip: a square, named for a screen reader with the same things.
 */
function QueueItem({
  app,
  borrower,
  compact,
  selected,
  focusable,
  onChoose,
}: {
  app: Application;
  borrower: string;
  compact: boolean;
  selected: boolean;
  focusable: boolean;
  onChoose: () => void;
}) {
  const who = `${borrower}, ${usdShort(app.amount_cents)} ${app.program} ${purposeShort(app.purpose)}`;
  const status = APPLICATION_STATUS[app.status].label;
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={compact ? `${who}, ${status}` : undefined}
      title={compact ? who : undefined}
      tabIndex={focusable ? 0 : -1}
      className={compact ? "rq-dot" : "rq-item"}
      data-status={app.status}
      onClick={onChoose}
    >
      {compact ? null : (
        <>
          <div className="rq-line">
            <span className="rq-name">{borrower}</span>
            <span className="rq-amount pk-mono">{usdShort(app.amount_cents)}</span>
          </div>
          <div className="rq-line pk-meta">
            <span className="rq-product">
              <span className="rq-program" data-program={app.program}>
                {app.program}
              </span>{" "}
              {purposeShort(app.purpose)}
            </span>
            <span className="rq-status">
              {isWaiting(app) ? monthDay(app.submitted_at) : status}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
