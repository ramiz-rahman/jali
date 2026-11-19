# Trips: a Jali example

A map-first trip planner for five days in Lisbon, built on `@jali/core` and `@jali/react` alone. A big map sits in the middle; around it are the days, each day's stops and the travel between them, the place you picked, hotels to compare, and the budget. It is one convincing slice of the job, not a product: plan the days to keep travel short and cheap, find somewhere to stay and eat nearby, and watch the money.

The sights are real Lisbon landmarks at their real coordinates. Every hotel and restaurant is made up, with an invented name at an invented spot, and every price (tickets, meals, nights, fares) is made up too. The app says so in its status line and marks each made-up business "Made up".

```sh
pnpm install         # at the repository's root
pnpm example:trips   # http://localhost:5340 (or the next free port)
```

The plan is kept on this device (`localStorage`). "Reset the trip", at the foot of the overview or in ⌘K, puts the bundled plan back, and that can be undone too.

Build it as a static site with `pnpm exec vp build` in this folder, and serve `dist/` from any path: assets are linked relative to the page, and the layout lives in the query string.

## What to try

- Click a numbered pin. The place pane, the map's card and the day's list all show that place. Click a stop in the day, or a result in Explore, and the map flies to it.
- Move through the days in the overview with J and K. The day plan and the map follow.
- Press **Optimise order** on Day 1. It says how much travel it saved; Undo puts the old order back (so does ⌘Z).
- Change a leg's mode: walk, transit or taxi. The minutes, the fare, the day's totals and the budget all change.
- Choose **Days** in the top bar: every day side by side. Drag a stop by its handle from one day to another, or onto a day in the overview. Narrow the window: days fold into tabs, and come back as it widens.
- Choose **Stay**: two hotels side by side. The left one is kept (Keep, in its header). Pick another hotel in the list and the right one shows it.
- Press Space on a stop or a result to peek at it. Press / or ⌘K ⌘P for "Go to place…", or ⌘K for "Add to day…" and "Optimise day…".
- Copy the link (the link button in the top bar) and open it in another window: the same layout, day and place.
- Make the window phone-sized. One pane at a time, with a switcher; open a place and it sits under the map it follows.

## How it is built

| File                    | What it shows                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/trip/places.ts`    | The places: real sights, made-up hotels and restaurants.                                                                          |
| `src/trip/travel.ts`    | Travel worked out offline: straight-line distance times a detour factor, a speed and a fare rule per mode.                       |
| `src/trip/optimise.ts`  | "Optimise order": nearest neighbour, then 2-opt, from and back to the hotel.                                                     |
| `src/trip/budget.ts`    | Spend by day and by category against an even share of the budget; transport comes from the legs.                                 |
| `src/trip/plan.ts`      | The plan as plain JSON, and the pure changes to it.                                                                               |
| `src/store.ts`          | The plan's store, saved on this device, with its own undo history.                                                                |
| `src/panes/*.tsx`       | The six pane kinds (trip, map, day, place, explore, budget) and the launcher, each `definePane` with params, a title and widths.  |
| `src/panes/map.tsx`     | MapLibre in a pane: honest widths, `map.resize()` from a ResizeObserver, nothing done while `paused`, pins as real buttons.        |
| `src/actions.ts`        | `selectPlace`: one place selected everywhere, through Jali's selection and the map's followers.                                    |
| `src/ui/drag.ts`        | Dragging a stop within a day and between day panes, with the app's own pointer drag beside Jali's.                                 |
| `src/presets.ts`        | The four layouts (Plan, Days, Stay, Budget); place panes follow the map, the day and the map follow the overview.                 |
| `src/workspace.ts`      | `createJali`: the kinds, presets, launcher, and the app's ⌘K commands, which ask with `jali.actions.choose`.                      |
| `src/shell/`            | The app's chrome inside `<JaliRoot>`: the top bar, the status line with Jali's `<Shelf />`, "/" and ⌘Z, the drag ghost, toasts.   |
| `src/styles/tokens.css` | The theme, after Nava: coral on zinc, set on Jali's `--jali-*` tokens, plus the day colours.                                     |

Day colours are never the only signal: every pin and every list names its day's number. A day over its share of the budget says so in words, with an icon.

`FINDINGS.md` lists where Jali's public API fell short or surprised, what the app does instead, and a suggested change for each.

## Tests

- `src/trip/trip.test.ts`: travel times and fares, a day's totals, the optimiser (it saves time on a first draft, is stable, and leaves a best order alone), changes to the plan and their undo, and the budget.
- `src/workspace.test.ts`: a workspace made with the app's kinds and presets, in memory: following, selecting a place everywhere, comparing two places, folding, presets and links, and the ⌘K commands.
- `e2e/trips.spec.ts`: a Playwright smoke test against this app's own server: the map, pins, the keys, optimise and undo, dragging a stop between days, a reload, ⌘K, and a phone. Run it from the repository's root with `pnpm exec playwright test -c examples/trips` (set `TRIPS_URL` if the server is on another port).

`screens/` holds screenshots of each layout at 1440, 1024 and 390 pixels wide, and two in dark.

## Data and licences

- **Map tiles:** [OpenFreeMap](https://openfreemap.org), free and without a key. The styles are its Positron (light) and Dark, recoloured a little at load. Map data is © OpenMapTiles and © OpenStreetMap contributors; the attribution shows on the map at all times, as OpenStreetMap requires. The tiles are the only thing the app fetches. Without them the map says it could not load, and the plan, the lists and the budget work as before.
- **No routing service.** Routes are drawn as straight lines between stops, and travel times come from the rules in `src/trip/travel.ts`. They are estimates for the example, not directions.
- **Businesses and prices:** every hotel, restaurant and price is made up. The sights are real places; their hours, visit lengths and ticket prices here are invented for the example.
- **Map library:** [MapLibre GL JS](https://maplibre.org), BSD-3-Clause.
- **Fonts:** Bricolage Grotesque and Chivo Mono come from Fontsource (`@fontsource-variable/*`), under the SIL Open Font License. Satoshi (`public/fonts/satoshi/`) was copied from the Nava repository, with its licence, Fontshare's Free Font EULA (`FFL.txt`). That licence limits redistribution of the font files, so check it, or replace Satoshi, before this example is published.
- **Design:** the look follows Nava's design tokens (coral on zinc, its radii and status colours). The app's name and mark are its own.
