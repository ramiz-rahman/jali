/**
 * The app's questions in Jali's chooser: "which day?" and "which place?", and the one way a place is offered to the
 * plan (`offerPlace`). ⌘K's commands, the panes' buttons and keys all ask through these, so a day and a place read
 * the same, and are offered the same, wherever they are.
 */
import type { Jali } from "jali-layout";
import type { Services } from "../state/services";
import { CATEGORY_ONE, isPlannable, PLACES, type Place } from "../trip/places";
import { CITY, type CityId } from "../trip/cities";
import { dayWith, type Day, type Plan, type Standing } from "../trip/plan";
import * as f from "../ui/format";

/**
 * Ask for a day: only the days in `city`, when a place can only go there, and not day `except`. `hint` says
 * something of each (by default its date, city and stops).
 */
export function chooseDay(
  jali: Jali,
  services: Services,
  title: string,
  onChoose: (n: number) => void,
  {
    except,
    city,
    hint = (d) => `${f.day(d.date)}, ${CITY[d.city].name}, ${d.stops.length} stops`,
  }: { except?: number; city?: CityId; hint?: (d: Day) => string } = {},
) {
  jali.dialogs.choose({
    title,
    items: services.plan.get().days.filter((d) => d.n !== except && (!city || d.city === city)),
    label: (d) => `Day ${d.n}: ${d.title}`,
    hint,
    placeholder: "Day or theme",
    onChoose: (d) => onChoose(d.n),
  });
}

/**
 * Ask for a place (type a name, an area or "food"), from those `only` lets through. Each says what it is, where,
 * and the day it is on.
 */
export function choosePlace(
  jali: Jali,
  services: Services,
  title: string,
  onChoose: (p: Place) => void,
  {
    only = () => true,
    placeholder = "Place, area or kind",
    hint = (p) => `${CATEGORY_ONE[p.category]}, ${p.area}, ${CITY[p.city].name}`,
  }: { only?: (p: Place) => boolean; placeholder?: string; hint?: (p: Place) => string } = {},
) {
  jali.dialogs.choose({
    title,
    items: PLACES.filter(only),
    label: (p) => p.name,
    hint: (p) => {
      const on = dayWith(services.plan.get(), p.id);
      return `${hint(p)}${on ? `, Day ${on.n}` : ""}`;
    },
    placeholder,
    onChoose,
  });
}

/**
 * Offer a place to the plan, the one way every button, key and command does: a hotel to stay at; a sight or a meal
 * to a day in its own city, other than the one it is on (a planned place moves). An airport is the flight's.
 */
export function offerPlace(jali: Jali, services: Services, p: Place) {
  if (p.category === "stay") return services.changes.stayAt(p.id);
  if (!isPlannable(p)) return;
  const on = dayWith(services.plan.get(), p.id);
  chooseDay(
    jali,
    services,
    `${on ? "Move" : "Add"} ${p.name} to…`,
    (n) => services.changes.addToDay(p.id, n),
    { city: p.city, except: on?.n },
  );
}

/** What offering a place does, as a command says it: "Stay at …", "Add … to a day…", "Move … to another day…". */
export function offerTitle(plan: Plan, p: Place): string {
  if (p.category === "stay") return `Stay at ${p.name}`;
  return dayWith(plan, p.id) ? `Move ${p.name} to another day…` : `Add ${p.name} to a day…`;
}

/** A button that puts a place on day `n`: "Move to Day 2" for a planned stop, "Add to Day 2" otherwise. */
export const offerLabel = (standing: Standing, n: number) =>
  `${standing.kind === "stop" ? "Move" : "Add"} to Day ${n}`;
