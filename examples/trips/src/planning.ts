/**
 * Changes to the plan that panes, the map and ⌘K share. Each one goes through the plan's undo history and says
 * what it did, with Undo, in a toast.
 */
import type { Jali } from "@jali/core";
import type { Services } from "./services";
import { optimiseDay, type Optimised } from "./trip/optimise";
import { CITY_NAME, mustPlace, placeById, type CityId } from "./trip/places";
import {
  canPlan,
  dayOf,
  dayWith,
  isHotel,
  moveStop,
  removeStop,
  setHotel,
  setStops,
} from "./trip/plan";
import * as f from "./ui/format";

const undo = (services: Services) => () => {
  const what = services.plan.undo();
  if (what) services.notify(`Undone: ${what}`);
};

/** Ask for a day in Jali's chooser: only the days in `city`, when a place can only go there. */
export function chooseDay(
  jali: Jali,
  services: Services,
  title: string,
  onChoose: (n: number) => void,
  { except, city }: { except?: number; city?: CityId } = {},
) {
  const plan = services.plan.get();
  jali.dialogs.choose({
    title,
    items: plan.days.filter((d) => d.n !== except && (!city || d.city === city)),
    label: (d) => `Day ${d.n}: ${d.title}`,
    hint: (d) => `${f.day(d.date)}, ${CITY_NAME[d.city]}, ${d.stops.length} stops`,
    placeholder: "Day or theme",
    onChoose: (d) => onChoose(d.n),
  });
}

/** Put a place on day `n` (at `index`, or the end). A place already planned moves. */
export function addToDay(services: Services, id: string, n: number, index?: number) {
  const plan = services.plan.get();
  const p = placeById(id);
  const day = dayOf(plan, n);
  if (!p || !day || p.category === "stay" || p.category === "airport") return;
  if (!canPlan(plan, id, n)) {
    // Never a cross-country leg: a place goes only on a day in its own city.
    services.notify(
      `${p.name} is in ${CITY_NAME[p.city]}, and Day ${n} is in ${CITY_NAME[day.city]}`,
    );
    return;
  }
  const was = dayWith(plan, id);
  if (was?.n === n && index === undefined) {
    services.notify(`${p.name} is already on Day ${n}`);
    return;
  }
  const label = was && was.n !== n ? `Moved ${p.name} to Day ${n}` : `Added ${p.name} to Day ${n}`;
  services.plan.change(was?.n === n ? `Moved ${p.name}` : label, (plan) =>
    moveStop(plan, id, n, index),
  );
  if (was?.n !== n) services.notify(label, { undo: undo(services) });
}

export function removeFromPlan(services: Services, id: string) {
  const p = mustPlace(id);
  const was = dayWith(services.plan.get(), id);
  if (!was) return;
  services.plan.change(`Removed ${p.name} from Day ${was.n}`, (plan) => removeStop(plan, id));
  services.notify(`Removed ${p.name} from Day ${was.n}`, { undo: undo(services) });
}

export function stayAt(services: Services, id: string) {
  const p = mustPlace(id);
  if (isHotel(services.plan.get(), id)) return;
  services.plan.change(`Stay at ${p.name}`, (plan) => setHotel(plan, id));
  services.notify(
    `Staying at ${p.name}. Every day in ${CITY_NAME[p.city]} now starts and ends there.`,
    {
      undo: undo(services),
    },
  );
}

/** Reorder day `n` to the quickest order found, and say what it saved. */
export function optimise(services: Services, n: number): Optimised | null {
  const plan = services.plan.get();
  const day = dayOf(plan, n);
  if (!day) return null;
  const r = optimiseDay(plan, day);
  if (r.savedMin <= 0) {
    services.notify(`Day ${n} is already in its quickest order`);
    return r;
  }
  services.plan.change(`Optimised Day ${n}`, (p) => setStops(p, n, r.stops));
  const cost =
    r.savedCost > 0
      ? ` and ${f.money(r.savedCost)}`
      : r.savedCost < 0
        ? `, for ${f.money(-r.savedCost)} more`
        : "";
  services.notify(`Day ${n}: ${f.minutes(r.savedMin)} less travel${cost}`, {
    undo: undo(services),
  });
  return r;
}

export function undoPlan(services: Services) {
  const what = services.plan.undo();
  services.notify(what ? `Undone: ${what}` : "Nothing to undo in the plan");
}

export function resetPlan(services: Services) {
  services.plan.reset();
  services.notify("The trip is back to the bundled plan", { undo: undo(services) });
}
