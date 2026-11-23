/**
 * The trip's budget, typed in: a draft while the person types, set on Enter or on leaving the field, and Esc puts
 * the budget back. Anything but digits and a point is ignored; an amount that isn't new and positive changes nothing.
 */
import { useState } from "react";
import { useServices } from "../../state/services";

export function BudgetField({ budget, disabled }: { budget: number; disabled: boolean }) {
  const { changes } = useServices();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    changes.changeBudget(Number(draft.replace(/[^\d.]/g, "")));
    setDraft(null);
  };
  return (
    <label className="budget-input">
      <span>Trip budget</span>
      <span className="money-field">
        <span aria-hidden>$</span>
        <input
          inputMode="numeric"
          value={draft ?? String(budget)}
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
          disabled={disabled}
        />
      </span>
    </label>
  );
}
