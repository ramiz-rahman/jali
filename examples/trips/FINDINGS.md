# Findings: what building Trips taught us about Jali's public API

Trips is built on the public API alone (`@jali/core`, `@jali/react`, and `storeOf` from `@jali/core/adapter` in tests only). Each finding says what the app wanted, what happened, what the app does instead, and a suggested change. The most important come first.

**Status, 20 Nov 2026.** Since these were written, Jali has fixed finding 2 (a preset makes a list's selection agree with its followers), finding 8 (Following shows as an icon in a narrow header), and the folding behind findings 6 and 11 for Days, which is now a row that scrolls sideways (`row({ scroll: "x" }, …)`). Trips dropped the workarounds those made unnecessary. Each finding below says where it stands.

## 1. A map-first app wants one selected place; Jali has one selection per list

**Wanted.** Pick a place anywhere (a pin, a stop in a day, a result in Explore, a nearby row) and have every pane agree: the place pane shows it, the map marks it and flies to it, the lists highlight it.

**What happened.** Jali's selection belongs to a list pane, and a detail follows one list (`linkedTo`). A place pane can follow the map, or the day plan, or Explore, but not "whichever the person used last". There is no workspace-level "current object".

**Workaround.** The map is the hub. Every place pane follows the map (`linkedTo: "map"`). A day plan or Explore list reports its own selection as usual and then hands the same ref to every map pane with `jali.actions.select(mapId, ref)` (`selectPlace` in `src/actions.ts`). Components that want "the place" read the map pane's selection with `useJaliState` (`src/selection.ts`), which needs `jali.model()` inside the selector to find the map's id.

It works, and it still runs through Jali's own selection and followers (the rest delay, Keep, comparing, one history entry). But it is a convention every app of this shape must invent, and calling `select` for a pane from outside it is not something the docs describe.

**Suggested change.** Let a detail follow a group of lists, or let a list's selection forward to another pane: for example `pane(place(), { linkedTo: ["map", "day", "explore"], follows: true })`, following whichever selected last, or `select(ref, { alsoFor: "map" })`. A hook to read a pane's selection by id or kind (`useSelection("map")`) would remove the model lookup inside a state selector.

## 2. After a preset switch, a list's selection and its followers disagree

**Wanted.** Switch from Plan (Day 1 on the map) to Budget (Day 7 on the map and the day plan) and see the overview marking Day 7.

**What happened.** The overview has the same id in both presets, so it keeps its selection (Day 1). The Budget preset's followers arrive showing their own refs (Day 7). The list says Day 1 and the panes that follow it say Day 5, until the person moves the cursor. The same happens to the map's selected place against the Days preset's place pane, and after Back, Forward or a link.

**Workaround.** The overview and the map watch their followers' refs (`useJaliModel`) and, when a layout change gives a follower another object, select that object (`src/panes/trip.tsx`, `src/panes/map.tsx`). Moving the cursor still drives the followers; the watch only fires when a follower's object changes.

**Suggested change.** When a layout replaces a follower's ref (a preset, `setLayout`, Back, a link), set the source's selection to it, or drop the source's selection so a list's "start on what the follower shows" logic runs again. Either way, say which in the Following guide.

**Now.** Fixed in Jali: after a preset or `setLayout`, a list that stays and its followers agree, and the layout's word wins. Trips' watches remain only for a list's first show, when it has no selection yet to agree with. One consequence: the map can no longer tell that selection from a person's pick, so it compares the preset id (finding 11, "A selection can't say where it came from").

## 3. The selection is not in the link

**Wanted.** "A copied link reopens the same arrangement with the same day and place."

**What happened.** The link carries every pane's ref, so the day and the place in the place pane come back. The selection does not. In a layout with no place pane (Budget), the place picked on the map is lost on reload.

**Workaround.** Every layout except Budget has a place pane that follows the map, and the map starts on what that pane shows (finding 2's watch). The e2e test checks that the Stay layout's two hotels survive a reload.

**Suggested change.** An opt-in `sel` param in the address, written with `replace` like a following step.

## 4. `openBeside` moves focus to the pane it opens from

**Wanted.** While comparing (a place pane kept), selecting a new place from the day plan opens a second place pane beside the map, and leaves the keyboard in the day plan.

**What happened.** `jali.actions.openBeside("map", ref)` focuses `map`, not the pane the person was in. The docs say "focus stays in `pane`", which reads as "focus does not move", but it means "focus goes to `pane`". For a pane opening its own link the two are the same; for code acting for another pane they are not.

**Workaround.** `selectPlace` notes `view.focused` before `openBeside` and focuses it again after.

**Suggested change.** Say plainly that focus moves to `pane`, and add an option to leave focus alone: `openBeside(pane, ref, { focus: false })`.

## 5. The app's undo and Jali's undo are two separate things

**Wanted.** One Undo for "Optimised Day 1", "Moved the Golden Mount to Day 2" and "Closed the budget pane".

**What happened.** `jali.actions.undo()` covers closes, close others and tucks. The app has no way to put its own changes on that history, so ⌘K ⌘Z undoes a closed pane and the app's Undo undoes the plan. And ⌘Z for the plan could not go in `keymap`: a binding there fires even while the person types in a field (Explore's search, the budget), where ⌘Z belongs to the field.

**Workaround.** The plan keeps its own undo history (`src/store.ts`). Each change toasts with its own Undo button. ⌘Z (Ctrl+Z) is a `window` listener that skips text fields and keys already handled (`AppKeys` in `src/shell/App.tsx`), and ⌘K lists "Undo the last change to the plan". "/" is handled the same way, since `keymap` rightly refuses a single key.

**Suggested change.** `jali.actions.pushUndo({ label, undo })`, so an app's change joins the same history, toast and ⌘K ⌘Z. And a `when` on app bindings, for example `keymap: { "trips.undo": { keys: "Mod+Z", when: "not-typing" } }`.

## 6. App drags live happily beside Jali's, but can't reach a folded pane

**Wanted.** Drag a stop from Day 6 to Day 7, side by side, and also to a day that has folded into a tab.

**What happened.** The two drags never meet. Jali's pane drag starts only from a header, so a pointer drag on a stop's handle (with `touch-action: none`, so it works with a finger) is the app's alone. Dropping across panes works because they share one DOM. Esc during a stop drag is the app's: it listens in the capture phase and stops the event, so Jali doesn't also restore a maximised pane or close the peek. Pane drags and stop drags both still work afterwards.

What doesn't work: a day folded into a tab can't be a drop target. Its pane is mounted but hidden, and hovering its tab during an app drag does nothing.

**Workaround.** The overview's day rows accept drops (the stop goes to the end of that day), and M on a stop asks "Move … to…" in Jali's chooser.

**Suggested change.** Show a tab's pane when an outside drag rests on its tab for a moment, as browsers do with tabs, or expose a "drag hover" hook on `.jali-tab` so the app can call `focus`.

**Now.** Days no longer folds: the week is a row that scrolls, and a stop held at its edge scrolls on to a day out of view (`edgeScroll`). A drop onto a folded tab is still not possible elsewhere.

## 7. "Is that other pane on screen?" takes a model lookup

**Wanted.** The map shows Explore's results while Explore is visible, and the place's neighbours otherwise.

**What happened.** A pane knows whether it is itself hidden (`paused`). Knowing that of another pane means reading `useJaliModel().resolved.panes` and its `hidden` field. Jali has no idea of "the results a list is showing", which is fair; the visibility check is the awkward part.

**Workaround.** Explore publishes its result ids to an app store with its pane id, and clears them while `paused`. The map uses them only while that pane is on screen (`src/panes/map.tsx`).

**Suggested change.** `jali.model().isShown(id)` and a `useIsShown(id)` hook.

## 8. Following and Keep crowd the title in a narrow header

**Wanted.** "Grand Palace" or "Map of Day 1" in the header of a 300 to 360 pixel pane.

**What happened.** The Following toggle and the Keep button take about 150 pixels, so titles shorten to "Gran…" and "Map of …" at the widths most detail panes have. The screenshots in `screens/` show it.

**Workaround.** None in the header. The place pane repeats the name large in its body, so nothing is lost there, but the header and tab read poorly.

**Suggested change.** Below a header width, show Following and Keep as icons, with their names as labels, as pinned tabs already do.

**Now.** Fixed in Jali for narrow headers. Trips goes further in its own styles: Following is an icon until the header is hovered or focused, at any width.

## 9. A pane in two presets showing different objects kept its component mounted

**Observed.** The Plan, Days, Stay and Budget layouts each have a pane `map`, showing different days. The presets guide says such a pane "starts afresh". In the browser the MapLibre canvas was the same element across every preset switch, and when the map followed the overview to another day. For a WebGL map that is what the app wants: no context rebuilt, no tiles fetched again.

**Suggested change.** Say what "afresh" means: pane state (`usePaneState`) and unsaved work are dropped, but the component is reused, so its own React state carries over. If reuse is not intended, say so, because a map would then rebuild on every switch and would need an option to stay.

## 10. What worked as hoped

- **A pane that wants the room.** `width: { min: 360, comfortable: 640 }` on the map and smaller minimums elsewhere: at 1440 pixels Plan fits four panes; at 1024 the place folds behind the map it follows; on Days, the seven days keep their width in a row that scrolls sideways between the overview and the map. A ResizeObserver calling `map.resize()` kept the canvas the size of its box through divider drags and folds.
- **Pause.** `paused` stops camera moves and resizes while the map is behind a tab, folded, or on another phone screen; the last move asked for runs when it is shown again. The map stays mounted, so its WebGL context survives.
- **A follower of another kind.** The map follows the overview with `follow: (selected) => ({ day: selected.params.n })`. The day plan and the map move together, as one change.
- **Keep to compare.** Keep a place pane, select another hotel, and a second place pane opens beside it. Stay opens that way from its preset (`kept: true`).
- **Rejecting a param from an old link.** The place kind's `id` param is a function that reads an id only if this trip has that place, and the day's `n` only from 1 to 7. A link from the Lisbon version of the example names `castelo`; Jali treats it as a link it can't read and opens the layout, with its toast, instead of a pane that says "not found". That was all it took.
- **The map's keys.** MapLibre claims the arrow keys with `preventDefault()` and ignores keys with ⌘, Ctrl or Alt, so Jali's content-first rule did the rest: arrows pan the map, F6 leaves it, ⌘K opens the palette from it, and Esc reaches Jali. The app had nothing to arbitrate.
- **Commands that ask twice.** "Add to day…" asks for a place, then for a day, by calling `jali.actions.choose` again from the first `onChoose`. It just worked.
- **Phones.** With `phone: { stack: true }`, and `phone: { place: "top" }` on the map kind, a portrait phone shows the place under the map it follows: a usable planner at 390 pixels with no phone-only code.

## 11. Two cities taught a few more things

The trip changed from one compact city (Lisbon) to two cities 680 km apart (Bangkok, then Phuket, with a flight between). Most of that was the app's own model: a city on every place, each day's city and hotel, per-city travel rules, a transfer day that starts with the flight. Jali needed nothing new for it. These are what it showed about Jali.

**The default pane cap folds a preset on a screen with room.** Days lays out seven days, the map and the place: nine panes. Jali's default cap is 8, so one day folded even at 3200 pixels wide. The workspace test caught it, not the eye: the folded tab looked like any fold for room. The app passed `settings: { paneCap: 10 }`, but that is only the default for a person with no saved settings, and a preset can't say "I am nine panes". Suggested change: let a preset raise the cap while it is in use (`{ id, label, layout, paneCap }`), and say in the shelf when a pane folded for the cap rather than for room. Now: Days is a row that scrolls, which the cap counts as one pane, so Trips keeps Jali's default.

**A selection can't say where it came from.** The map flies to a place when the person picks it, but must not fly when the app sets the map's selection to match a place pane the layout brought (finding 2's watch): on a Phuket day it would fly to a Bangkok place. Jali's events carry `input` (person, code, agent), but a selection fires no event and records no source. The map remembers the one selection it set itself and skips it (`quietSelection` in `src/panes/map.tsx`). Suggested change: a `select` event with `input`, or `select(ref, { quiet: true })` for selections the app makes that should not count as the person's. Now: Jali itself selects on the map when a preset brings a place pane (finding 2's fix), and that selection is indistinguishable from a pick too, so the map also treats a selection that arrives with a preset change as the layout's (`src/panes/map.tsx`). A `source` on the selection, or a `select` event with it, would replace both guesses.

**Saved state has no version.** The plan's own key could be versioned (`trips:plan:v2`). Jali's saved pane state (a cursor on a Lisbon place, Explore's filters) sits under the storage prefix with no version, so the app changed its prefix (`trips-thailand`) to leave it behind; a person's saved settings went with it. Suggested change: `createJali({ storage: { prefix, version } })`, dropping pane state from another version and keeping settings.

**A pane's own data decides what it can accept, which Jali can't see.** A place can only go on a day in its city. The app's drag, the chooser (only days in the place's city are offered) and the place pane's day buttons all apply the rule; a drop on a day of the other city is refused with a note. That is app logic, as it should be. Nothing in Jali needed to know.

## 12. A divider in a row that scrolls says its maximum is infinite

**Observed.** The shared quality checks (axe, 21 Nov 2026) found every divider in Days' week with `aria-valuemax="Infinity"`. A pane in a row that scrolls can grow without limit, so Jali's fit gives the divider no maximum (`packages/core/src/layout/fit/resolve.ts`, `scrolls ? Infinity : …`), and the divider writes it as a percentage. `aria-valuemax` must be a number, so axe reports `aria-valid-attr-value` (critical), and a screen reader may read nonsense or nothing for the divider's range.

**Workaround.** None the app can make: the day kind already says `width.max: 480`, and the divider ignores it in a row that scrolls. `e2e/quality.spec.ts` lists the six week dividers as Jali's (`axeKnown`), so every other check still runs on them.

**Suggested change.** In a row that scrolls, give the divider the first pane's `width.max` when it has one, and otherwise leave `aria-valuemax` out, so it takes ARIA's default for a separator (100).

**Now.** Fixed in Jali (21 Nov 2026): a divider in a row that scrolls leaves `aria-valuemax` out. The `axeKnown` entries are gone from `e2e/quality.spec.ts`.

## Not about Jali

- MapLibre 6 loads its Web Worker from beside its own module. Bundled by Vite, the worker can't be found ("Worker failed to load"). `setWorkerUrl` with a `?url` import of `maplibre-gl/dist/maplibre-gl-worker.mjs` fixes it.
- MapLibre moves a marker's element with `transform`, so scaling that element (a selected pin) moves it too. The pin is a button inside the marker's element.
