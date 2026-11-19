# Trips: a Jali example

A map-first trip planner for a week in Thailand, built on `@jali/core` and `@jali/react` alone: three days in Bangkok, a day that flies to Phuket, and three days in Phuket. A big map sits in the middle; around it are the days, each day's stops and the travel between them, the place you picked, hotels to compare, and the budget. It is one convincing slice of the job, not a product: plan the days to keep travel short and cheap, find somewhere to stay and eat nearby, and watch the money.

The sights, beaches and airports are real places at their real coordinates. Every hotel and restaurant is made up, with an invented name at an invented spot, and every price (tickets, meals, nights, fares, the flight) is made up too, in US dollars at levels plausible for Thailand. The app says so in its status line and marks each made-up business "Made up".

## The trip

| Day           | City              | Plan                                                                         |
| ------------- | ----------------- | ---------------------------------------------------------------------------- |
| 1, Thu 11 Feb | Bangkok           | Temples of the old city: Wat Arun by ferry, the Grand Palace, Wat Pho        |
| 2, Fri 12 Feb | Bangkok           | Chinatown, Jim Thompson House, Lumphini Park, Yaowarat at night              |
| 3, Sat 13 Feb | Bangkok           | Chatuchak weekend market, the Marble Temple, the Golden Mount, Khao San Road |
| 4, Sun 14 Feb | Bangkok to Phuket | To Suvarnabhumi, the flight, then Karon Beach and dinner at Kata             |
| 5, Mon 15 Feb | Phuket            | Old Town, Khao Rang, Wat Chalong, the Big Buddha                             |
| 6, Tue 16 Feb | Phuket            | The southern beaches: Promthep Cape, Kata, Nai Harn                          |
| 7, Wed 17 Feb | Phuket            | The north: Bang Pae Waterfall, Surin, Kamala, Patong                         |

One hotel per city. Each day starts and ends at its city's hotel; the transfer day starts at the Bangkok hotel and ends at the Phuket one.

```sh
vp install            # at the repository's root
vp dev examples/trips # http://localhost:5340 (or the next free port)
```

The plan is kept on this device (`localStorage`, under `trips:plan:v2`; a plan saved by the earlier Lisbon version is ignored). "Reset the trip", at the foot of the overview or in ⌘K, puts the bundled plan back, and that can be undone too.

Build it as a static site with `pnpm exec vp build` in this folder, and serve `dist/` from any path: assets are linked relative to the page, and the layout lives in the query string.

## What to try

- Look at a place: the place pane opens on its photo. The ⓘ on a photo says who took it and under which licence. A made-up hotel or restaurant gets a stand-in photo of the kind of room, view or dish it offers, labelled "Stand-in photo".
- Pick a pin: it wears its place's photo above it. Each day in the overview has a strip of its stops' photos, and each stop in a day has its own, with the hours it takes (arrive, leave).
- Click a numbered pin. The place pane and the day's list both show that place. Where no place pane is on screen (a narrow window, a phone, Budget), a card at the foot of the map shows it instead. Click a stop in the day, or a result in Explore, and the map flies to it, across the country if it is in the other city.
- Move through the days in the overview with J and K. The day plan and the map follow; the map frames each day in its own city. "All" shows the whole trip: a badge for each city and the flight between them.
- Open Day 4, "Fly to Phuket": the ride to the airport, the flight with its time and fare, then the afternoon in Phuket.
- Scroll to the foot of a day: "Close to this day" lists places near its stops that aren't planned yet, with the walk or ride from the nearest. + adds one; "Find a place" asks for any other in the city.
- Press **Optimise the order** on Day 1 or Day 6. It says how much travel it saved; Undo puts the old order back (so does ⌘Z).
- Change a leg's mode. Bangkok has walking, the BTS, MRT or a river boat, and a taxi or tuk-tuk; Wat Arun is across the river, so the way there is the ferry. Phuket has walking, taxis and a hired scooter. Day 7 is over its share of the budget on taxis; switch its legs to the scooter and it comes under.
- Choose **Days** in the top bar: the whole week, every day at a comfortable width, in a row that scrolls sideways between the overview and the map (Jali's `row({ scroll: "x" }, …)`), so no day folds into a tab, however narrow the window. Swipe sideways over it, or Shift and the wheel. Open a day from the overview and it glides into view. Drag a stop by its handle from one day to another of the same city, holding it at the week's edge to scroll on to a day out of view, or drop it on a day in the overview. A Bangkok stop dropped on a Phuket day is refused, with a note.
- Choose **Stay**: two Bangkok hotels side by side. The left one is kept (Keep, in its header). Pick another hotel in the list and the right one shows it, read against the kept one: a night, the nights in the city, and the average trip to your stops, each with its difference. Switch the list to Phuket to choose there.
- Press Space on a stop or a result to peek at it. Press / or ⌘K ⌘P for "Go to place…", or ⌘K for "Add to day…" and "Optimise day…".
- Maximise a pane (its header's maximise button, or ⌘⇧Enter). A place opens on a tall photo held beside its details; a day, Explore and the budget keep a readable width in the middle.
- Pop a pane out into its own window (the pop-out button in its header, or "Pop out pane" in ⌘K; Chrome and Edge on desktop, experimental in Jali): a day on a second screen beside the map, still changing with the plan.
- Copy the link (the link button in the top bar) and open it in another window: the same layout, day and place.
- Make the window phone-sized. One pane at a time, with a switcher; open a place and it sits under the map it follows.

## How it is built

| File                    | What it shows                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/trip/photos.ts`    | Each place's photo: its size, tone (shown while it loads), alt text, credit and licence. Written by `scripts/photos.mjs`.                                                    |
| `src/ui/photo.tsx`      | `<Photo>`: the photo in its tone until it loads, cropped to fill, with the credit behind an ⓘ.                                                                               |
| `src/trip/places.ts`    | The places, each in a city: real sights, beaches and airports; made-up hotels and restaurants.                                                                               |
| `src/trip/travel.ts`    | Travel worked out offline: distance times a detour factor, a speed and a fare rule per mode and per city; the ferry; the flight.                                             |
| `src/trip/optimise.ts`  | "Optimise the order": nearest neighbour, then 2-opt, from where the day's stops begin to the city's hotel.                                                                   |
| `src/trip/budget.ts`    | Spend by day and by category (stay, sights, food, transport, flight) against an even share of the budget.                                                                    |
| `src/trip/plan.ts`      | The plan as plain JSON (two hotels, each day's city, the transfer day), its routes, and the pure changes to it.                                                              |
| `src/store.ts`          | The plan's store, saved on this device, with its own undo history.                                                                                                           |
| `src/panes/*.tsx`       | The six pane kinds (trip, map, day, place, explore, budget) and the launcher, each `definePane` with params, a title and widths.                                             |
| `src/panes/map.tsx`     | MapLibre in a pane: honest widths, `map.resize()` from a ResizeObserver, nothing done while `paused`, pins as real buttons, a badge per city when zoomed out to the country. |
| `src/actions.ts`        | `selectPlace`: one place selected everywhere, through Jali's selection and the map's followers.                                                                              |
| `src/ui/drag.ts`        | Dragging a stop within a day and between day panes, with the app's own pointer drag beside Jali's.                                                                           |
| `src/presets.ts`        | The four layouts (Plan, Days with the week in a row that scrolls, Stay, Budget); place panes follow the map, the day and the map follow the overview.                        |
| `src/workspace.ts`      | `createJali`: the kinds, presets, launcher, and the app's ⌘K commands, which ask with `jali.actions.choose`.                                                                 |
| `src/shell/`            | The app's chrome inside `<JaliRoot>`: the top bar, the status line with Jali's `<Shelf />`, "/" and ⌘Z, the drag ghost, toasts.                                              |
| `src/styles/tokens.css` | The theme, after Nava: coral on zinc, set on Jali's `--jali-*` tokens, plus the day colours.                                                                                 |

Day colours are never the only signal: every pin and every list names its day's number. A day over its share of the budget says so in words, with an icon.

`FINDINGS.md` lists where Jali's public API fell short or surprised, what the app does instead, and a suggested change for each.

## Tests

- `src/trip/trip.test.ts`: travel times and fares per city, the ferry and the flight, routes from and to each city's hotel and the transfer day, the optimiser (it saves time, keeps the flight first, is stable), changes to the plan (never across cities) and their undo, reading an old Lisbon plan, and the budget.
- `src/trip/photos.test.ts`: every place and both city covers have a photo in both widths, each credited under a licence that allows reuse, and a made-up business's photo is always a stand-in that says so.
- `src/workspace.test.ts`: a workspace made with the app's kinds and presets, in memory: following, selecting a place everywhere, comparing two places, folding, presets and links, the ⌘K commands, and refusing a place on a day in the other city.
- `e2e/trips.spec.ts`: a Playwright smoke test against this app's own server: the map, pins, the keys, optimise and undo, dragging a stop between days (and a refused drop across cities), the flight day, a reload, ⌘K, a phone, and an old saved Lisbon plan. Run it from the repository's root with `pnpm exec playwright test -c examples/trips` (set `TRIPS_URL` if the server is on another port).

`screens/` holds screenshots of each layout at 1440, 1024 and 390 pixels wide, and two in dark.

## Data and licences

- **Photos:** 62 photographs from [Wikimedia Commons](https://commons.wikimedia.org), each under CC0, public domain, CC BY or CC BY-SA, credited on the photo (the ⓘ) with its author, licence and a link to its page. `src/trip/photos.ts` lists them all. They are bundled in `public/photos` (WebP, 1200 and 440 pixels wide, about 8 MB in all), so the app needs no image service. Real sights, beaches and airports show themselves. Every hotel and restaurant is made up, so each shows a stand-in, a photo of the kind of room, view or dish it offers, labelled "Stand-in photo", and some stand-ins were taken elsewhere in Thailand or abroad. To change a photo, edit `SOURCES` in `scripts/photos.mjs` (it needs `vips` and `cwebp`) and run `node scripts/photos.mjs`: it checks each licence again and refuses anything that doesn't allow reuse.
- **Map tiles:** [OpenFreeMap](https://openfreemap.org), free and without a key. The styles are its Positron (light) and Dark, recoloured a little at load. Map data is © OpenMapTiles and © OpenStreetMap contributors; the attribution shows on the map at all times, as OpenStreetMap requires. The tiles are the only thing the app fetches from another site. Without them the map says it could not load, and the plan, the lists and the budget work as before.
- **No routing service.** Routes are drawn as straight lines between stops (the flight as an arc), and travel times come from the rules in `src/trip/travel.ts`. They are estimates for the example, not directions or timetables. The map's labels are OpenStreetMap's, so many are in Thai with a Latin form.
- **Businesses and prices:** every hotel, restaurant and price is made up, in US dollars. The sights are real places; their hours, visit lengths and ticket prices here are invented for the example, as are the fares and the flight.
- **Map library:** [MapLibre GL JS](https://maplibre.org), BSD-3-Clause.
- **Fonts:** Bricolage Grotesque and Chivo Mono come from Fontsource (`@fontsource-variable/*`), under the SIL Open Font License. Satoshi (`public/fonts/satoshi/`) was copied from the Nava repository, with its licence, Fontshare's Free Font EULA (`FFL.txt`). That licence limits redistribution of the font files, so check it, or replace Satoshi, before this example is published.
- **Design:** the look follows Nava's design tokens (coral on zinc, its radii and status colours). The app's name and mark are its own.
