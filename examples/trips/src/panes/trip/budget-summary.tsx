import type { TripBudget } from "../../trip/budget";
import * as f from "../../ui/format";

/** The money so far: planned against the budget, as a figure and a meter, and the days over their allowance. */
export function BudgetSummary({ budget }: { budget: TripBudget }) {
  const used = Math.min(1, budget.total / budget.budget);
  const over = budget.overDays;
  const each = f.moneyRound(budget.allowance);
  return (
    <section className="trip-budget" aria-label="Budget summary">
      <p>
        <span className="num big">{f.moneyRound(budget.total)}</span>
        <span className="muted"> planned of {f.moneyRound(budget.budget)}</span>
      </p>
      <div
        className="meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget.budget}
        aria-valuenow={Math.round(budget.total)}
        aria-label="Planned spend against the budget"
        data-over={budget.left < 0 || undefined}
      >
        <span style={{ width: `${used * 100}%` }} />
      </div>
      <p className="muted small">
        {budget.left >= 0
          ? `${f.moneyRound(budget.left)} left`
          : `${f.moneyRound(-budget.left)} over the budget`}
        {`, ${each} a day to spend.`}
        {over.length
          ? ` ${over.length === 1 ? `Day ${over[0]} is` : `Days ${over.slice(0, -1).join(", ")} and ${over.at(-1)} are`} over.`
          : null}
      </p>
    </section>
  );
}
