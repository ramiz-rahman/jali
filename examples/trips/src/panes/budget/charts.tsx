/**
 * The budget's two charts, drawn by hand in CSS. By day: each day's spending (sights, food, getting around), split
 * by category, on a scale that always fits the day's allowance, which is marked on the bar. By category: the whole
 * trip, one bar per category, against the budget (or the total, when that is more).
 */
import { WarningIcon } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import { BUDGET_CATEGORIES, BUDGET_LABEL, SPENDING, type TripBudget } from "../../trip/budget";
import type { TripSummary } from "../../trip/summary";
import { DayMark } from "../../ui/day-mark";
import * as f from "../../ui/format";

/** How the pane drives the list of days: the cursor, its keys and a press, from `useCursorList`. */
export interface DayListProps {
  /** The rows' ids start with it, for `aria-activedescendant`. */
  idPrefix: string;
  cursor: number;
  active: boolean;
  onKeyDown: (e: KeyboardEvent) => void;
  press: (n: number) => void;
  listProps: Record<string, string>;
}

/**
 * The days, as a list the map and the day plan follow (Budget's layout links them to it), each with its spending
 * split by category and the allowance marked.
 */
export function ByDay({ summary, list }: { summary: TripSummary; list: DayListProps }) {
  const b = summary.budget;
  // The scale: the day that spends most or the allowance, whichever is more, so the allowance's mark always fits.
  const scale = Math.max(...b.days.map((d) => d.spend), b.allowance, 1) * 1.08;
  return (
    <div
      className="budget-days"
      role="listbox"
      aria-label="Days"
      tabIndex={0}
      aria-activedescendant={`${list.idPrefix}-${list.cursor}`}
      onKeyDown={list.onKeyDown}
      {...list.listProps}
    >
      {summary.days.map(({ day, budget: d }) => (
        <div
          key={d.n}
          id={`${list.idPrefix}-${d.n}`}
          role="option"
          aria-selected={d.n === list.cursor}
          data-active={(d.n === list.cursor && list.active) || undefined}
          className="budget-day"
          data-over={d.over || undefined}
          onClick={() => list.press(d.n)}
        >
          <span className="budget-day-label">
            <DayMark n={d.n} size="sm" />
            <span>
              <b>Day {d.n}</b>
              <span className="muted">{f.day(day.date)}</span>
            </span>
          </span>
          <span className="bar">
            {SPENDING.map((c) => (
              <span key={c} data-cat={c} style={{ width: `${(d.byCategory[c] / scale) * 100}%` }} />
            ))}
            <i className="bar-share" style={{ left: `${(d.allowance / scale) * 100}%` }} />
          </span>
          <span className="budget-day-total num">
            {d.over ? <WarningIcon size={14} weight="bold" aria-hidden /> : null}
            {f.money(d.spend)}
            {d.over ? <span className="over-text small">{f.money(d.overBy)} over</span> : null}
          </span>
          <span className="sr-only">
            , of {f.money(d.allowance)} to spend:{" "}
            {SPENDING.map((c) => `${BUDGET_LABEL[c]} ${f.money(d.byCategory[c])}`).join(", ")}.
          </span>
        </div>
      ))}
    </div>
  );
}

export function ByCategory({ budget: b }: { budget: TripBudget }) {
  return (
    <ul className="budget-cats">
      {BUDGET_CATEGORIES.map((c) => (
        <li key={c} className="budget-cat">
          <span className="budget-cat-label">{BUDGET_LABEL[c]}</span>
          <div
            className="bar"
            role="img"
            aria-label={`${BUDGET_LABEL[c]}: ${f.money(b.byCategory[c])}`}
          >
            <span
              data-cat={c}
              style={{ width: `${(b.byCategory[c] / Math.max(b.budget, b.total)) * 100}%` }}
            />
          </div>
          <span className="num">{f.money(b.byCategory[c])}</span>
          <span className="muted small num">
            {b.total ? Math.round((b.byCategory[c] / b.total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}
