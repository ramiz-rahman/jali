/**
 * The budget: planned spend by day and by category, against the trip's budget, with transport fed by each day's
 * legs. A day over its share of the budget is marked with words and an icon, not colour alone. The chart is drawn
 * by hand in CSS: one bar per day, split by category, with the day's share marked on it.
 */
import { useState } from "react";
import { WalletIcon, WarningIcon } from "@phosphor-icons/react";
import { definePane, useJali, usePaneState, type PaneProps } from "@jali/react";
import { showDay } from "../actions";
import { usePlan, useServices } from "../services";
import { BUDGET_CATEGORIES, BUDGET_LABEL, tripBudget, type BudgetCategory } from "../trip/budget";
import { setBudget } from "../trip/plan";
import { stringIn } from "../stored";
import * as f from "../ui/format";
import { DayMark, Segmented } from "../ui/parts";

type View = "day" | "category";

function BudgetPane({ inPeek }: PaneProps) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const [view, setView] = usePaneState<View>("view", "day", { parse: stringIn("day", "category") });
  const b = tripBudget(plan);
  const [draft, setDraft] = useState<string | null>(null);
  // The scale: the dearest day or the day's share, whichever is more, so the share mark always fits.
  const scale = Math.max(...b.days.map((d) => d.total), b.days[0]?.allowance ?? 1) * 1.08;
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/[^\d.]/g, ""));
    if (n > 0 && n !== plan.budget)
      services.plan.change(`Budget set to ${f.moneyRound(n)}`, (p) => setBudget(p, n));
    setDraft(null);
  };

  return (
    <div className="pane-body budget">
      <header className="budget-head">
        <div>
          <p className="budget-total">
            <span className="num">{f.moneyRound(b.total)}</span>
          </p>
          <p className="muted">
            planned of a {f.moneyRound(b.budget)} budget,{" "}
            {b.left >= 0 ? (
              <>{f.moneyRound(b.left)} left</>
            ) : (
              <b className="over-text">{f.moneyRound(-b.left)} over</b>
            )}
          </p>
        </div>
        <label className="budget-input">
          <span>Trip budget</span>
          <span className="money-field">
            <span aria-hidden>$</span>
            <input
              inputMode="numeric"
              value={draft ?? String(plan.budget)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape" && draft !== null) {
                  e.preventDefault();
                  setDraft(null);
                }
              }}
              disabled={inPeek}
            />
          </span>
        </label>
      </header>

      <div className="budget-toolbar">
        <Segmented
          label="Show by"
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "By day" },
            { value: "category", label: "By category" },
          ]}
        />
        <ul className="budget-key" aria-label="Categories">
          {BUDGET_CATEGORIES.map((c) => (
            <li key={c} data-cat={c}>
              {BUDGET_LABEL[c]}
            </li>
          ))}
        </ul>
      </div>

      {view === "day" ? (
        <ol className="budget-days">
          {b.days.map((d) => {
            const day = plan.days.find((x) => x.n === d.n);
            if (!day) return null;
            return (
              <li key={d.n} className="budget-day" data-over={d.over || undefined}>
                <button
                  type="button"
                  className="budget-day-label"
                  onClick={() => showDay(jali, d.n)}
                >
                  <DayMark n={d.n} size="sm" />
                  <span>
                    <b>Day {d.n}</b>
                    <span className="muted">{f.day(day.date)}</span>
                  </span>
                </button>
                <div
                  className="bar"
                  role="img"
                  aria-label={`Day ${d.n}: ${f.money(d.total)} of a ${f.money(d.allowance)} share${d.over ? ", over" : ""}. ${BUDGET_CATEGORIES.map((c) => `${BUDGET_LABEL[c]} ${f.money(d.byCategory[c])}`).join(", ")}.`}
                >
                  {BUDGET_CATEGORIES.map((c) => (
                    <span
                      key={c}
                      data-cat={c}
                      style={{ width: `${(d.byCategory[c] / scale) * 100}%` }}
                    />
                  ))}
                  <i
                    className="bar-share"
                    style={{ left: `${(d.allowance / scale) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <span className="budget-day-total num">
                  {d.over ? <WarningIcon size={14} weight="bold" aria-hidden /> : null}
                  {f.money(d.total)}
                  {d.over ? (
                    <span className="over-text small">{f.money(d.total - d.allowance)} over</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <ul className="budget-cats">
          {BUDGET_CATEGORIES.map((c: BudgetCategory) => (
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
                {Math.round((b.byCategory[c] / b.total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="budget-note muted small">
        <WalletIcon size={14} aria-hidden /> Each day's share is{" "}
        {f.money(b.days[0]?.allowance ?? 0)}: the budget over {plan.days.length} days. Transport is
        the sum of the day's legs, so a scooter instead of a taxi in Phuket shows here; the flight
        is its own line. Every price in this example is made up.
      </p>
    </div>
  );
}

export const budget = definePane("budget", {
  title: "Budget",
  icon: WalletIcon,
  width: { min: 340, comfortable: 460, max: 640 },
  height: { min: 300 },
  Component: BudgetPane,
});
