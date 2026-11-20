/**
 * The workspace: the pane kinds, the four layouts (presets), the launcher, and the app's own commands in ⌘K. The
 * "…" commands ask for a place or a day with `jali.actions.choose`. `createTripsJali` takes the app's services and
 * Jali's usual options, so a test can give it a memory address, memory storage and a fixed size.
 */
import { createJali, type Command, type Jali, type JaliOptions } from "@jali/core";
import { makerCommand } from "#shared/maker/maker";
import { selectPlace, showDay } from "./actions";
import { budget } from "./panes/budget";
import { day } from "./panes/day";
import { explore } from "./panes/explore";
import { launcher } from "./panes/launcher";
import { map } from "./panes/map";
import { place } from "./panes/place";
import { trip } from "./panes/trip";
import { addToDay, chooseDay, optimise, resetPlan, stayAt, undoPlan } from "./planning";
import { presets } from "./presets";
import type { Services } from "./services";
import { CATEGORY_ONE, CITY_NAME, PLACES, type Place } from "./trip/places";
import { dayWith } from "./trip/plan";
import { optimiseDay } from "./trip/optimise";
import * as f from "./ui/format";

export const kinds = [trip, map, day, place, explore, budget];

type Options = Pick<
  JaliOptions,
  "url" | "storage" | "size" | "moveFocus" | "preset" | "keymapOptions"
>;

export function createTripsJali(services: Services, options: Options = {}): Jali {
  const placeHint = (p: Place) => {
    const on = dayWith(services.plan.get(), p.id);
    return `${CATEGORY_ONE[p.category]}, ${p.area}, ${CITY_NAME[p.city]}${on ? `, Day ${on.n}` : ""}`;
  };
  /** Ask for a place (type a name, an area or "food"). */
  const pickPlace = (
    jali: Jali,
    title: string,
    onPick: (p: Place) => void,
    only?: (p: Place) => boolean,
  ) =>
    jali.actions.choose({
      title,
      items: PLACES.filter((p) => !only || only(p)),
      label: (p) => p.name,
      hint: placeHint,
      placeholder: "Place, area or kind",
      onChoose: onPick,
    });

  const commands: Command[] = [
    {
      id: "trips.go",
      title: "Go to place…",
      group: "Trip",
      run: (jali) =>
        pickPlace(
          jali,
          "Go to place…",
          (p) => selectPlace(jali, p.id, { open: true }),
          (p) => p.category !== "airport",
        ),
    },
    {
      id: "trips.add",
      title: "Add to day…",
      group: "Trip",
      run: (jali) =>
        pickPlace(
          jali,
          "Add to day…",
          (p) =>
            p.category === "stay"
              ? stayAt(services, p.id)
              : chooseDay(jali, services, `Add ${p.name} to…`, (n) => addToDay(services, p.id, n), {
                  city: p.city,
                }),
          (p) => p.category !== "airport",
        ),
    },
    {
      id: "trips.optimise",
      title: "Optimise day…",
      group: "Trip",
      run: (jali) => {
        const plan = services.plan.get();
        jali.actions.choose({
          title: "Optimise day…",
          items: plan.days,
          label: (d) => `Day ${d.n}: ${d.title}`,
          hint: (d) => {
            const r = optimiseDay(plan, d);
            return r.savedMin > 0 ? `saves ${f.minutes(r.savedMin)}` : "already quickest";
          },
          placeholder: "Day or theme",
          onChoose: (d) => {
            optimise(services, d.n);
            showDay(jali, d.n);
          },
        });
      },
    },
    {
      id: "trips.day",
      title: "Go to day…",
      group: "Trip",
      run: (jali) => chooseDay(jali, services, "Go to day…", (n) => showDay(jali, n)),
    },
    {
      id: "trips.stay",
      title: "Stay at…",
      group: "Trip",
      run: (jali) =>
        pickPlace(
          jali,
          "Stay at…",
          (p) => stayAt(services, p.id),
          (p) => p.category === "stay",
        ),
    },
    {
      id: "trips.undo",
      title: "Undo the last change to the plan",
      group: "Trip",
      run: () => undoPlan(services),
    },
    {
      id: "trips.reset",
      title: "Reset the trip to the bundled plan",
      group: "Trip",
      run: () => resetPlan(services),
    },
    {
      id: "trips.theme",
      title: "Switch between light and dark",
      group: "Settings",
      run: (jali) => {
        const { theme } = jali.get().settings;
        const systemDark = !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        const dark = theme === "dark" || (theme === "system" && systemDark);
        jali.actions.changeSettings({ theme: dark ? "light" : "dark" });
      },
    },
  ];

  return createJali({
    panes: kinds,
    launcher,
    presets,
    commands: [...commands, makerCommand],
    name: "Trip",
    keymap: { "trips.go": "Mod+K Mod+P", "trips.optimise": "Mod+K Mod+O" },
    // A new prefix for the Thailand trip, so pane state saved for the Lisbon one (a cursor on a Lisbon place) is left behind.
    storage: "trips-thailand",
    // On a portrait phone: a pane with the one it follows, one above the other. The place shows under the map it
    // follows, and the day under the overview, instead of one at a time.
    phone: { stack: true },
    // Pop out a pane into its own window: a day beside the map on a second screen. Jali leaves it off until an
    // app turns it on; the button goes before Close in each header (the rest is in the pane's ⋯ menu), and ⌘K has
    // Jali's "Pop out pane".
    allow: { popOut: true },
    buttons: (defaults) => [...defaults.filter((b) => b !== "close"), "popOut", "close"],
    ...options,
  });
}
