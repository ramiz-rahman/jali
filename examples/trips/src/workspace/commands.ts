/**
 * The app's own commands in ⌘K. The "…" ones ask for a place or a day (choosers.ts), then make the change
 * (`services.changes`) or move the workspace (hub.ts).
 */
import type { Command } from "jali-layout";
import type { Services } from "../state/services";
import { summarise } from "../trip/summary";
import * as f from "../ui/format";
import { chooseDay, choosePlace, offerPlace } from "./choosers";
import { selectPlace, showDay } from "./hub";
import { toggleTheme } from "./theme";

/** Keys for the commands that have them. */
export const KEYMAP = { "trips.go": "Mod+K Mod+P", "trips.optimise": "Mod+K Mod+O" };

export function tripCommands(services: Services): Command[] {
  const notAirport = { only: (p: { category: string }) => p.category !== "airport" };
  return [
    {
      id: "trips.go",
      title: "Go to place…",
      group: "Trip",
      run: (jali) =>
        choosePlace(
          jali,
          services,
          "Go to place…",
          (p) => selectPlace(jali, services, p.id, { open: true }),
          notAirport,
        ),
    },
    {
      id: "trips.add",
      title: "Add to day…",
      group: "Trip",
      run: (jali) =>
        choosePlace(
          jali,
          services,
          "Add to day…",
          (p) => offerPlace(jali, services, p),
          notAirport,
        ),
    },
    {
      id: "trips.optimise",
      title: "Optimise day…",
      group: "Trip",
      run: (jali) => {
        const summary = summarise(services.plan.get());
        chooseDay(
          jali,
          services,
          "Optimise day…",
          (n) => {
            services.changes.optimise(n);
            showDay(jali, n);
          },
          {
            hint: (d) => {
              const saved = summary.day(d.n)?.best.savedMin ?? 0;
              return saved > 0 ? `saves ${f.minutes(saved)}` : "already quickest";
            },
          },
        );
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
        choosePlace(jali, services, "Stay at…", (p) => services.changes.stayAt(p.id), {
          only: (p) => p.category === "stay",
        }),
    },
    {
      id: "trips.undo",
      title: "Undo the last change to the plan",
      group: "Trip",
      run: () => services.changes.undo(),
    },
    {
      id: "trips.reset",
      title: "Reset the trip to the bundled plan",
      group: "Trip",
      run: () => services.changes.resetPlan(),
    },
    {
      id: "trips.theme",
      title: "Switch between light and dark",
      group: "Settings",
      run: toggleTheme,
    },
  ];
}
