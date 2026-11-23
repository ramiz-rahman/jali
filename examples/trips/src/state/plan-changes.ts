/**
 * Every change the person makes to the plan, shared by the panes, the map and ⌘K. Each one goes through the plan's
 * undo history with a label that says what it was, and the bigger ones say so in a toast, with Undo. They are made
 * once, bound to the plan's store and the way to tell the person (`services.changes`).
 */
import { CITY } from "../trip/cities";
import { modeName, type Mode } from "../trip/modes";
import { isPlannable, mustPlace, placeById } from "../trip/places";
import {
  dayOf,
  dayWith,
  isHotel,
  moveStop,
  removeStop,
  reorder,
  setBudget,
  setHotel,
  setMode,
  setStops,
} from "../trip/plan";
import { summarise } from "../trip/summary";
import { legKey, type Leg } from "../trip/travel";
import * as f from "../ui/format";
import type { PlanStore } from "./plan-store";

/** A short message for the person, with an optional Undo. */
export type Notify = (text: string, options?: { undo?: () => void }) => void;

export type PlanChanges = ReturnType<typeof createPlanChanges>;

export function createPlanChanges(plan: PlanStore, notify: Notify) {
  /** A toast's Undo: quiet when there is nothing left to undo. */
  const undoing = {
    undo: () => {
      const what = plan.undo();
      if (what) notify(`Undone: ${what}`);
    },
  };

  return {
    /** Undo the last change to the plan, and say what it was. */
    undo() {
      const what = plan.undo();
      notify(what ? `Undone: ${what}` : "Nothing to undo in the plan");
    },

    /** Put a place on day `n` (at `index`, or the end). A place already planned moves. */
    addToDay(id: string, n: number, index?: number) {
      const now = plan.get();
      const p = placeById(id);
      const day = dayOf(now, n);
      if (!p || !day || !isPlannable(p)) return;
      if (p.city !== day.city) {
        // Never a cross-country leg: a place goes only on a day in its own city.
        notify(`${p.name} is in ${CITY[p.city].name}, and Day ${n} is in ${CITY[day.city].name}`);
        return;
      }
      const was = dayWith(now, id);
      const within = was?.n === n;
      if (within && index === undefined) {
        notify(`${p.name} is already on Day ${n}`);
        return;
      }
      const label = within
        ? `Moved ${p.name}`
        : was
          ? `Moved ${p.name} to Day ${n}`
          : `Added ${p.name} to Day ${n}`;
      plan.change(label, (x) => moveStop(x, id, n, index));
      // A move within the day shows itself; one to another day says where it went.
      if (!within) notify(label, undoing);
    },

    /** Move the stop at `from` to `to` within day `n` (Alt+↑ and Alt+↓). */
    moveWithinDay(n: number, from: number, to: number) {
      const stops = dayOf(plan.get(), n)?.stops ?? [];
      const id = stops[from];
      if (id === undefined || to < 0 || to >= stops.length) return;
      plan.change(`Moved ${mustPlace(id).name} in Day ${n}`, (x) => reorder(x, n, from, to));
    },

    removeFromPlan(id: string) {
      const was = dayWith(plan.get(), id);
      if (!was) return;
      const label = `Removed ${mustPlace(id).name} from Day ${was.n}`;
      plan.change(label, (x) => removeStop(x, id));
      notify(label, undoing);
    },

    stayAt(id: string) {
      const p = mustPlace(id);
      if (isHotel(plan.get(), id)) return;
      plan.change(`Stay at ${p.name}`, (x) => setHotel(x, id));
      notify(
        `Staying at ${p.name}. Every day in ${CITY[p.city].name} now starts and ends there.`,
        undoing,
      );
    },

    /** Reorder day `n` to the quickest order found, and say what it saved. */
    optimise(n: number) {
      const r = summarise(plan.get()).day(n)?.best;
      if (!r) return;
      if (r.savedMin <= 0) {
        notify(`Day ${n} is already in its quickest order`);
        return;
      }
      plan.change(`Optimised Day ${n}`, (x) => setStops(x, n, r.stops));
      const cost =
        r.savedCost > 0
          ? ` and ${f.money(r.savedCost)}`
          : r.savedCost < 0
            ? `, for ${f.money(-r.savedCost)} more`
            : "";
      notify(`Day ${n}: ${f.minutes(r.savedMin)} less travel${cost}`, undoing);
    },

    /** Take `mode` for a leg; pressing the mode already chosen goes back to the suggestion. */
    chooseMode(leg: Leg, mode: Mode) {
      const key = legKey(leg.from, leg.to);
      const to = mustPlace(leg.to).name;
      plan.change(`${modeName({ mode, ferry: leg.ferry }, leg.city)} to ${to}`, (x) =>
        setMode(x, key, x.modes[key] === mode ? null : mode),
      );
    },

    /** Back to the mode the leg would get by itself. */
    suggestedMode(leg: Leg) {
      plan.change(`Suggested mode to ${mustPlace(leg.to).name}`, (x) =>
        setMode(x, legKey(leg.from, leg.to), null),
      );
    },

    /** Set the trip's budget, in dollars, when it is a new, positive amount. */
    changeBudget(budget: number) {
      if (!(budget > 0) || budget === plan.get().budget) return;
      plan.change(`Budget set to ${f.moneyRound(budget)}`, (x) => setBudget(x, budget));
    },

    resetPlan() {
      plan.reset();
      notify("The trip is back to the bundled plan", undoing);
    },
  };
}
