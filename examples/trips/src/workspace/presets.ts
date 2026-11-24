/**
 * The four layouts in the top bar (and ⌘K as "Layout: …"). Every one has a map with the id "map": it is the hub,
 * the list every place pane follows (`linkedTo: "map"`, hub.ts). Where there is an overview ("overview"), the day
 * plan and the map follow it, so moving through the days moves both; in Budget, the budget's days lead them instead.
 *
 * The layout, the day each pane shows and the place in the place pane are all in the address, so a copied link
 * reopens the same arrangement.
 */
import { pane, row, type PresetOptions } from "jali-layout";
import { DEFAULT_PLAN } from "../trip/plan";
import { budgetRef, dayRef, exploreRef, mapRef, placeRef, tripRef, WHOLE_TRIP } from "./refs";

const followsOverview = { linkedTo: "overview", follows: true } as const;
const followsMap = { linkedTo: "map", follows: true } as const;
const followsBudget = { linkedTo: "budget", follows: true } as const;

export const presets: PresetOptions[] = [
  {
    // The planner: the days, the map, the day and the place selected.
    id: "plan",
    label: "Plan",
    layout: row(
      pane(tripRef(), { id: "overview", weight: 0.8 }),
      pane(mapRef(1), { id: "map", ...followsOverview, weight: 2.2 }),
      pane(dayRef(1), { id: "day", ...followsOverview, weight: 1 }),
      pane(placeRef("grand-palace"), { id: "place", ...followsMap, weight: 0.95 }),
    ),
  },
  {
    // The whole week, to balance the days: all seven at a comfortable width in a row that scrolls sideways (none
    // fold), between the overview and a tall map of the trip. No place pane: the room goes to the days, and the map
    // shows the place picked as a card at its foot. Drag a stop from one day to another; near the strip's edge it
    // scrolls on to the days out of view.
    id: "days",
    label: "Days",
    layout: row(
      pane(tripRef(), { id: "overview", px: 280 }),
      row(
        { id: "week", scroll: "x" },
        ...DEFAULT_PLAN.days.map(({ n }) => pane(dayRef(n), { id: `day-${n}` })),
      ),
      pane(mapRef(WHOLE_TRIP), { id: "map", px: 380 }),
    ),
  },
  {
    // Choosing where to stay: hotels to search, the map, and two Bangkok hotels compared. The first is kept (Keep,
    // in its header); the second follows whatever is selected.
    id: "stay",
    label: "Stay",
    layout: row(
      pane(exploreRef("stay"), { id: "explore", weight: 0.9 }),
      pane(mapRef(1), { id: "map", weight: 1.6 }),
      pane(placeRef("h-riverside"), { id: "place-kept", linkedTo: "map", kept: true }),
      pane(placeRef("h-silom"), { id: "place", ...followsMap }),
    ),
  },
  {
    // The money: the budget, whose days lead the map and the day plan, opening on Day 7, the one day over (on taxis
    // in Phuket). Moving through the days shows where each one's money goes. Side by side, so the map has the full
    // height to frame a day; where there isn't room for three, the day folds behind the map it sits beside.
    id: "budget",
    label: "Budget",
    layout: row(
      pane(budgetRef(), { id: "budget", weight: 1.1 }),
      pane(mapRef(7), { id: "map", ...followsBudget, weight: 1.6 }),
      pane(dayRef(7), { id: "day", ...followsBudget, weight: 1 }),
    ),
  },
];
