/**
 * The four layouts in the top bar (and ⌘K as "Layout: …"). Every one has a map with the id "map": it is the list
 * every place pane follows (`linkedTo: "map"`). Where there is an overview ("overview"), the day plan and the map
 * follow it, so moving through the days moves both.
 *
 * The layout, the day each pane shows and the place in the place pane are all in the address, so a copied link
 * reopens the same arrangement.
 */
import { column, pane, row, type PresetOptions } from "jali";
import { budget } from "./panes/budget";
import { day } from "./panes/day";
import { explore } from "./panes/explore";
import { map } from "./panes/map";
import { place } from "./panes/place";
import { trip } from "./panes/trip";

const followsOverview = { linkedTo: "overview", follows: true } as const;
const followsMap = { linkedTo: "map", follows: true } as const;

export const presets: PresetOptions[] = [
  {
    // The planner: the days, the map, the day and the place selected.
    id: "plan",
    label: "Plan",
    layout: row(
      pane(trip(), { id: "overview", weight: 0.8 }),
      pane(map({ day: 1 }), { id: "map", ...followsOverview, weight: 2.2 }),
      pane(day({ n: 1 }), { id: "day", ...followsOverview, weight: 1 }),
      pane(place({ id: "grand-palace" }), { id: "place", ...followsMap, weight: 0.95 }),
    ),
  },
  {
    // The whole week, to balance the days: all seven at a comfortable width in a row that scrolls sideways (none
    // fold), between the overview and a map of the trip with the place picked. Drag a stop from one day to another;
    // near the strip's edge it scrolls on to the days out of view.
    id: "days",
    label: "Days",
    layout: row(
      pane(trip(), { id: "overview", px: 300 }),
      row(
        { id: "week", scroll: "x" },
        pane(day({ n: 1 }), { id: "day-1" }),
        pane(day({ n: 2 }), { id: "day-2" }),
        pane(day({ n: 3 }), { id: "day-3" }),
        pane(day({ n: 4 }), { id: "day-4" }),
        pane(day({ n: 5 }), { id: "day-5" }),
        pane(day({ n: 6 }), { id: "day-6" }),
        pane(day({ n: 7 }), { id: "day-7" }),
      ),
      column(
        { px: 400 },
        pane(map({ day: 0 }), { id: "map", weight: 1.4 }),
        pane(place({ id: "grand-palace" }), { id: "place", ...followsMap }),
      ),
    ),
  },
  {
    // Choosing where to stay: hotels to search, the map, and two Bangkok hotels compared. The first is kept (Keep,
    // in its header); the second follows whatever is selected.
    id: "stay",
    label: "Stay",
    layout: row(
      pane(explore({ category: "stay" }), { id: "explore", weight: 0.9 }),
      pane(map({ day: 1 }), { id: "map", weight: 1.6 }),
      pane(place({ id: "h-riverside" }), { id: "place-kept", linkedTo: "map", kept: true }),
      pane(place({ id: "h-silom" }), { id: "place", ...followsMap }),
    ),
  },
  {
    // The money: the budget beside the days, and the map of the day picked (the dearest, a day of Phuket taxis).
    id: "budget",
    label: "Budget",
    layout: row(
      pane(budget(), { id: "budget", weight: 1.4 }),
      pane(trip(), { id: "overview", weight: 0.8 }),
      column(
        { weight: 1.5 },
        pane(map({ day: 7 }), { id: "map", ...followsOverview, weight: 1.5 }),
        pane(day({ n: 7 }), { id: "day", ...followsOverview }),
      ),
    ),
  },
];
