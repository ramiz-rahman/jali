# Findings: what Studio asked of Jali's public API

Studio is built on `@jali/core` and `@jali/react` alone, with no change to `packages/`. Most of what it needed was there and fit well (see "What worked" at the end). These are the places where the API fell short, was awkward, or did something unexpected. Each has what we wanted, what happened, the workaround in the app, and a suggested change. The most important come first.

## 1. One follower's unsaved work stops every follower of the list

**Wanted.** The library drives four followers: the transcript, the timeline, the mixer and the markers. With unsaved corrections in the transcript, moving the library should keep the transcript on its session (the guide says "a following detail with unsaved work keeps its object") and move the others.

**Happened.** Nothing moves. The follow step is one change for all followers, and the workspace refuses the whole change when any of them would lose work (an `op: "follow"` with unsaved work is refused with "The detail stays put"). The timeline and the mixer, which have nothing unsaved, stay on the old session too. The transport has meanwhile loaded the new one, so every pane says "Not in the transport". `workspace.test.ts` pins this down ("holds every follower of the library while one of them has unsaved work").

**Workaround.** While the transcript has unsaved corrections it keeps itself (`jali.actions.setKept(node.id, true)`), and lets go when they are saved or discarded, which makes it catch up at once (`panes/transcript.tsx`). The person sees Keep pressed in its header. A Keep the person pressed is left alone.

**Suggestion.** Hold only the follower with unsaved work and move the rest in the same change, with the same "stays put" announcement. If holding them all is deliberate, say so in the Following guide, and let the follow step report what it held (an event, or the refusal in `select`'s result).

**Fixed in Jali:** only the follower with unsaved work is held, with the same "stays put" announcement, and the others move in the same change. Once its work is saved or discarded, it catches up at once. The transcript no longer keeps itself. There is no event for what was held yet: the announcement is the report.

## 2. `useActivity(undefined)` leaves the last activity standing

**Wanted.** The timeline reports `"loading"` while the session's music renders, then nothing. The mixer reports `"working"` while sound goes through it, then nothing.

**Happened.** The reference says "`undefined` reports nothing", and the hook does exactly that: it calls `setActivity` only for a truthy value, so it never clears. The timeline kept its grey loading dot after the music had rendered. Nothing clears the activity on unmount either, unlike `useUnsaved`.

**Workaround.** Pass `"idle"` instead of `undefined` (`panes/timeline.tsx`, `panes/mixer.tsx`).

**Suggestion.** Make `undefined` (and unmount) clear the pane's activity, as `useUnsaved` does with a falsy value. If `undefined` must mean "leave it as it is", document that `"idle"` is the way to stop reporting.

**Fixed in Jali:** `useActivity(undefined)` now clears the activity, as does unmount; Studio passes `undefined` again.

## 3. Space: no public way to give an app-wide key to an app command

**Wanted.** Space plays and pauses, as in every audio tool, from anywhere except where it types or presses something. The brief warned that Jali uses Space for peek.

**Happened.** Jali binds no single keys at all. Space for peek is a convention each list implements in its own `onKeyDown`, and Jali's `peek` action then picks the peek sheet or the following detail. So nothing of Jali's needed moving. But nothing in the public API helps the app take Space either:

- `keymap: { "studio.play": "Space" }` is refused: "a single character key belongs to the focused content (WCAG 2.1.4)". `Shift+Space` is refused the same way.
- `reservedKeys: ["Space"]` is accepted silently and drops nothing, since nothing is bound to Space. It records intent, nothing more.
- The app has to repeat Jali's own judgement of "is this key the content's": text fields, contenteditable, comboboxes, Jali's dialogs, and controls that Space presses (Jali's tabs and header buttons are buttons and `role="tab"`). Jali has this logic inside but does not export it.
- After a pointer click a button keeps focus, and Space presses it again. Studio's toolbar buttons prevent focus on `mousedown`, so Space stays the transport's; Jali's header buttons keep focus, so after clicking Keep, Space presses Keep.

**Workaround.** One `keydown` handler on the window, in the bubble phase, after the content (`shell/keys.ts`), with its own list of targets that keep Space. Play and pause is also an app command bound to ⌘K ⌘P, so it is in ⌘K and the keymap. The lists' peek moved to ⇧Space. The README explains the rule.

**Suggestion.** Either let an app command take a single key when the app says it is app-wide (for example `keymap: { "studio.play": { keys: "Space", when: "not-typing" } }`), applied by Jali after the content has had its turn and with Jali's own typing and control checks; or export the check (`keyBelongsToContent(event)`) so apps don't copy it. Document the Space convention for lists in one place, with what an app should do when it wants Space for itself.

**Fixed in Jali:** `keyBelongsToContent(event)` is exported from `@jali/react`, documented with the Space convention in the commands and keys guide. `shell/keys.ts` uses it.

## 4. A layout switch leaves a list and its new follower disagreeing

**Wanted.** Compare starts with segment 4 kept and segment 6 following the transcript. The transcript is the same pane in Edit and Compare (same id, same object), so it keeps its state and its cursor.

**Happened.** After switching from Edit (cursor on segment 5) to Compare, the following detail shows segment 6 (the preset's ref) while the transcript's selection is still segment 5. Calling `select` again with the same ref changes nothing: the selection is unchanged, so no follow step runs.

**Workaround.** The transcript watches `presetId`; on a change it adopts the segment its follower shows (`panes/transcript.tsx`). The layout's word wins, so Compare starts on 4 and 6 as designed.

**Suggestion.** After a preset (or `setLayout`) puts a new follower beside a list that has a selection, decide one way and do it: follow the list's selection, or reset the selection to match. A preset option could say which.

**Fixed in Jali:** the layout's word wins. After a preset or `setLayout`, a follower of the selected kind resets the list's selection to what it shows, and with none of that kind the followers follow the selection. The transcript no longer watches `presetId`, and Compare still starts on 4 kept and 6 following.

## 5. Tokens are `light-dark()` pairs, which a canvas can't read

**Wanted.** The waveforms, the timeline and the meters are drawn on canvas in the theme's colours, light and dark.

**Happened.** `getComputedStyle(el).getPropertyValue("--jali-text")` returns the unresolved string `light-dark(…)` (custom properties are not resolved), and a canvas ignores a `fillStyle` it can't parse, so the first bars took the previous colour or black.

**Workaround.** A hidden probe element: set `color: var(--token)` and read the computed `color`, once per theme (`ui/waveform.ts`). The canvases draw again when `useTheme()` changes, and once more on the next frame, so they see the page's new `data-theme`.

**Suggestion.** Note this in the Theming guide for anyone drawing with the tokens, or export a helper that resolves a token to a colour for the current theme.

## 6. Activity has no "live" state

**Wanted.** A hidden mixer, folded into a tab, should say that sound is going through it.

**Happened.** The closest is `"working"`. On the shelf it is a spinning ring, which reads as "busy, wait", and screen readers hear "Working". A spinner over a live mix is the wrong sign.

**Workaround.** `"working"`, with `--jali-working` set to signal orange, so it reads more like Spoke's recording dot than a busy teal.

**Suggestion.** An activity for ongoing, healthy, live work (`"live"`, drawn as a steady or pulsing dot, announced as "Live"), or a way for the app to label an activity for screen readers.

## 7. Heights have only a minimum

**Wanted.** The timeline is a short, wide pane: about 200 pixels is right at any window size. In Edit it sits under the transcript, in Review across the bottom.

**Happened.** `PaneHeight` has `min` only. Spare height in a column is shared by weight, so on a tall screen the timeline grows to a third of the height, and on a short one the weights need tuning per preset. Widths have `comfortable` and `max`; heights do not.

**Workaround.** Weights chosen per preset (`presets.ts`), and lane heights that scale with the pane.

**Suggestion.** `height.comfortable` and `height.max`, with the same rules as width: spare room past `max` goes to the neighbours first.

## 8. A narrow pane with folded tabs keeps all its header buttons

**Wanted.** At 760 pixels the library holds the folded markers as a tab, which is fine.

**Happened.** Its header shows the tab strip, the overflow menu, "+", tuck, maximise, full screen and close. The shown tab's title shrinks to "L…" before any button gives way.

**Workaround.** `allow: { fullScreen: false }` on the library and markers kinds: a list has nothing to show full screen, and the header has one button fewer.

**Suggestion.** In a narrow header, move tuck, maximise and full screen into a menu before the shown tab's title drops below a few characters.

## 9. A wide pane folded into a narrow one's tabs can fold everything

**Wanted.** Compare at 760 pixels: the library and the transcript, with the two segments and the timeline as tabs.

**Happened.** In the first version of Compare the timeline (minimum 440) sat under the two segments. At 760 the segments folded, then the timeline folded into the library's tab group, since it follows the library. A tab group is as narrow as its widest tab allows, so the library's group became 440 wide, the transcript no longer fitted beside it, and it folded too: one pane on screen, "4 folded" on the shelf. Each step follows the documented rules; together they gave the worst result.

**Workaround.** Compare now puts the timeline under the transcript, so a fold never sends a wide pane into the library (`presets.ts`). At 760 it shows the library, the transcript and the timeline, with the two segments as tabs of the transcript.

**Suggestion.** When choosing where a folded pane goes, prefer a group whose minimum it doesn't raise, or let fitting compare the outcome of folding into the source against folding into a neighbour.

## 10. Smaller things

- **Peek with a following detail.** ⇧Space (Studio's peek) shows the row in the following detail, not in the peek sheet. That is the documented rule, but it surprises an app whose own handler calls `peek(ref)` and sees no sheet. A line in `PaneProps.peek`'s reference would help.
- **Titles can't read app state.** A kind's `title` is a function of its params, so a renamed speaker appears in the segment detail's title only through `useTitle`, and the peek sheet keeps the kind's title. The two titles differ for the same object.
- **The chooser can't mark the current item.** "Playback speed…" lists 0.75× to 1.5×, with no way to start on or mark the one in use. A `current` option on `ChooseOptions` would do. Studio writes "now" in the hint.
- **Keep is what the brief called pinning.** Jali's "pin" is for tabs; "keep" is for a follower that stops following. Clear once known, but a reader looks for "pin" first.
- **Chained following is by hand.** Library, then transcript, then segment detail: when the library moves on, the detail follows only once the transcript, having changed session, reports a new selection from its own effect. It is how a list should behave, but each list in a chain has to remember to do it.

## Theming Jali to look like hardware

Studio was restyled so that each pane reads as a device on a desk: faceplates, key caps that travel, knobs, a jog wheel, screens and an LCD (README, "Styling"). This is what that taught us about Jali's theming surface.

**Easy, through the supported surface.**

- **Faceplates.** `.jali-pane` takes any background and layered `box-shadow`, so a pane became a molded body with a lit top edge and a side wall. `[data-focused]` carries focus as an attribute, so the focused device got an orange ring and a lit lamp in its header.
- **One unit in another body.** Setting tokens on one pane (`.jali-pane[data-kind="mixer"]`, with `color-scheme: dark`) made the mixer black anodised in the light theme, header and tabs included. Tokens on a subtree work as the Theming guide promises.
- **Tabs, the shelf, the switcher, drop zones, the drag chip, the peek.** Each has a public selector with its state in attributes (`aria-selected`, `data-folded`, `data-reason`, `data-drop-zone`), so tabs became latched keys and shelf chips small keys with no fight.
- **Dialogs and menus.** `--jali-shadow-dialog`, `--jali-shadow-menu`, `--jali-surface-raised` and `--jali-radius-menu` were enough to make ⌘K, the chooser, Settings and the tab menus look molded.
- **`light-dark()` pairs.** One declaration per token covers both themes. The cascade layer (`@layer base, jali, app`) meant no `!important` anywhere in the restyle.

**Possible only by reaching through a public part to an element inside it.** These parts have no public selector of their own, so the rules depend on Jali's markup staying as it is:

- **The header's buttons** (tuck, maximise, full screen, close) are reached as `.jali-pane-actions button`. To make them keys we needed each button, and each one's state; the only selectors are private classes (`.jali-icon-btn`, `.jali-act-close`).
- **The ⌘K and chooser field** is reached as `.jali-scrim [role="combobox"]`, and the dialog box as `.jali-scrim > [role="dialog"]`. The Parts reference lists the scrim and the items, not the dialog or its field, though both are what an app most wants to restyle. Studio puts the field behind black glass.
- **"Discard unsaved changes?"** Its buttons are reached as `.jali-scrim [role="alertdialog"] button`. There is no way to tell its primary button from its secondary one except by order or private class, so Studio gives both the key shape and leaves Jali's colours.
- **The palette's key hints** are reached as `.jali-palette-item kbd`, and the group label as a private class we left alone.

**Not reachable at all.**

- **Hover and pressed states of Jali's own buttons.** There is no attribute for "pressed" on a header button or a tab while the pointer is down. `:active` works, but nothing says "this is a toggle" except `aria-pressed` on the Follow and Keep toggle.
- **The Following status text and Keep toggle.** They are one part (`.jali-follow-toggle`), so the printed "Following" and the Keep key can't be told apart except by element (`button`).
- **The divider's line.** `[data-divider]` is public, but the line it lights on hover is a private child (`.jali-divider-line`). Studio wanted a slot cut into the desk there; it leaves the divider as Jali draws it, coloured by `--jali-border-strong`.
- **Icons are one weight and one size per place.** A hardware legend wants glyphs drawn as print, and Jali passes only `size` to an icon. `<JaliRoot icons>` could replace them all, but at a per-place size Studio doesn't control.

**Suggestions.**

- Add public parts for the header's buttons (`data-action="close" | "tuck" | "zoom" | "fullscreen"`), the palette's dialog and field (`.jali-palette`, `.jali-palette-input` are already there: list them), and the confirm dialog's buttons with a `data-role="primary"`.
- Give pressable chrome a `data-pressed` while the pointer is down, and toggles `aria-pressed` everywhere they latch.
- Document which structural selectors are safe, or say plainly that only the listed parts are, so an app knows what will break.

## Theming gaps, consolidated (for the next change to Jali's API)

The deeper restyle (one tiled top row, one set of parts for every button-like thing, square corners everywhere) needed the items below. For each: the part, what Studio used, and the API that would make it clean. Everything else went through `--jali-*` tokens and the public parts with no trouble.

1. **Pane header buttons** (tuck, maximise, full screen, close). Used `.jali-pane-actions button`; the buttons themselves carry only private classes (`.jali-icon-btn`, `.jali-act-close`, …). Want: a public part `.jali-pane-action` with `data-action="tuck" | "zoom" | "fullscreen" | "close"`.
2. **Keep and Following.** `.jali-follow-toggle` turned out to be the Keep button itself, not a container (the Parts reference doesn't say), and the printed "Following" is the private `.jali-follow-status`. Studio hides the status in narrow headers with `@container jali-header (max-width: 400px)`, a container name that is Jali's internal. Want: `.jali-follow-status` public, the parts' element types documented, and a public header container name or a `data-narrow` attribute on narrow headers.
3. **The ⌘K and chooser dialog and its field.** Used `.jali-scrim > [role="dialog"]` and `.jali-scrim [role="combobox"]`. `.jali-palette` and `.jali-palette-input` exist but are not listed as parts. Want: both listed as public parts, and a token for the dialog's padding.
4. **"Discard unsaved changes?" buttons.** Used `.jali-scrim [role="alertdialog"] button`, and `:last-of-type` to find the primary one (the only marker is the private `.is-primary`). Want: `data-role="primary" | "secondary"` on every dialog button, public.
5. **Palette rows' key hint and group label.** Used `.jali-palette-item kbd`; the group is private `.jali-palette-group`. Want: both as public parts.
6. **Corners Jali hard-codes.** These ignore `--jali-radius`, `--jali-radius-control` and `--jali-radius-menu`: the palette, Settings and confirm dialogs (12px), the Keep toggle (4px), a tab's close button (4px), the rename field (4px), tab menu items (5px), the shelf's chips, their inner buttons, "more" and its menu (5px), the kept badge (4px), the peek label (4px), the investigation chips (7px). Studio squared them with `:where(.jali-shelf, .jali-pane-header, .jali-peek, .jali-tab-menu, [data-jali-layer]) :where(button, input, li, kbd)` and `.jali-scrim > *`. Want: every radius in Jali's styles reads one of the radius tokens (add `--jali-radius-chip` if a fourth size is needed), so `--jali-radius*: 2px` is enough.
7. **The gap between panes.** `GAP` is a constant (6px). Faceplates with a 3 to 4px side wall nearly touch; the top row uses a 3px gap and the panes can't match it. Want: `--jali-gap` (read by the layout's measuring too) or `createJali({ gap })`.
8. **The pane's own shadow and focus.** To add a ring for focus, Studio repeats the whole shadow stack in `.jali-pane[data-focused]` (Jali's own focus is a 0.5px accent shadow plus border colour). Want: tokens `--jali-pane-shadow`, `--jali-pane-shadow-focused` and `--jali-pane-border`, so a theme sets them once.
9. **Divider line.** `[data-divider]` is public; the line it lights is the private `.jali-divider-line`, coloured by `--jali-border-strong`. Want: the line as a public part, or a `--jali-divider-hover` token.
10. **Adornments on tabs and switcher items.** A latched tab gets its lamp from `::before`, since a tab takes no children of the app's. If Jali ever uses `::before` there, the lamp breaks. Want: a documented slot (for example `tabAdornment(pane)` returning a node), or a promise that `::before` and `::after` on public parts are the app's.
11. **Shelf menu and shelf chip internals.** `.jali-shelf-menu`, `.jali-shelf-chip-main`, `.jali-shelf-chip-put` and `.jali-shelf-more` are private; reached as `.jali-shelf button`. Want: listed as parts.
12. **Icon sizes.** Jali passes a fixed `size` to each icon (12 to 16px by place). Hardware keys want larger glyphs in header buttons. Want: a size token per place (`--jali-icon-header`, `--jali-icon-tab`) or a size in the `icons` map.
13. **Activity marks.** Only their colours are tokens; their shape (a dot, a spinning ring) is fixed. Studio wanted a lamp for "working". Want: activity marks as public parts with `data-activity`, so an app can draw its own.
14. **Pressed state.** Jali's buttons have no attribute while held; `:active` covers the pointer, but a key held from the keyboard (Space, Enter on a tab) shows no travel. Want: `data-pressed` while a Jali control is held, by pointer or key.
15. **Folded tabs' treatment.** Italic is hard-coded for `data-folded`. Fine, but a token (`--jali-tab-folded-style`) would let a hardware theme print a dotted rim instead without fighting it.

16. **Header buttons come and go per pane.** Which of tuck, maximise, full screen and close a header shows depends on the pane (a lone or allowed-less pane shows only close), so the "one low strip" treatment changes length from pane to pane, and a strip painted on the container showed an empty segment. Studio paints each button's part of the strip on the button itself. Want: a stable header shape (for example disabled rather than absent, as an option), or `data-count` on `.jali-pane-actions`.
17. **Icon sizes in the header, again.** The round push-button treatment wanted a 12px glyph on a 20px cap; Jali renders its icons at 14px with a fixed `size`, so Studio overrides `.jali-pane-actions svg` width and height. Want the icon size tokens from item 12.
18. **The header's layout is fixed.** The order is grip, title, Following and Keep, then the buttons; an app can't put its own control there or join Keep with the buttons in one set. Want: a header slot (`headerActions(pane)` returning app controls, placed by Jali) and a documented order.
19. **Type sizes are per part, in rem.** Jali sets its own sizes on each part (about 30 rules: titles 0.8125rem, tabs, chips, menus, palette). A wider face (Chakra Petch) meant retuning size and tracking part by part. Want: a small type scale as tokens (`--jali-text-xs`, `-sm`, `-md`) that every part reads, and `--jali-tracking`.
20. **No figures token.** Jali's own numbers (key hints, counts like "+2") follow `--jali-font-mono`. Studio points that at its main face and keeps a separate readout face for ticking numbers; Jali has no numbers that tick, so this is fine today, but a `--jali-font-numeric` would let an app choose tabular figures for Jali's counts too.
21. **Palette and chooser rows' parts.** A row's name wrapped in Chakra Petch; it has no public selector (`.palette-title`, without even the `jali-` prefix), so Studio keeps it on one line as `.jali-palette-item > :first-child`. Want: the row's name, hint and keys as public parts.

22. **The workspace's inset can't follow the app's grid.** The top bar and the foot rail are flush to the window and sit on a 4px grid with a 20px side margin for their parts; the panes sit 6px in from the workspace's edges and 6px apart (`GAP`), so a faceplate's edge can't line up with the slab's groups above it. Want: `--jali-gap` and `--jali-inset` (item 7), read by the layout's measuring too.
23. **Images can't follow the theme through `light-dark()`.** The grain is an SVG image; `light-dark()` takes colours only, so the app switches it with `[data-theme="dark"]` and a `prefers-color-scheme` rule, relying on Jali writing `data-theme` on `<html>`. Want: Jali's resolved theme also as an attribute on its own root and layer (`[data-jali][data-theme]`), documented, for a workspace with `pageTheme: false`.

24. **A pane can't tell the app its own size cleanly.** The mixer adapts to its height (short: smaller dials, a one-line scribble strip; very short: fewer scale numbers) with `container: mixer / size` on its body. That works because Jali gives the content a definite height, which is not documented. Want: the content box's size contract documented (a definite width and height for `Component`), or the pane's size passed to the component (`usePaneSize()`), so an app can lay out by it without guessing.
25. **Sticky inside a pane.** The mixer pins its master module with `position: sticky` inside its own scroller. It works, but the pane's content wrapper (`.jali-pane-content-inner`, private) also scrolls, so a sticky element there would stick to Jali's scroller instead. Want: a documented rule for which element scrolls in a pane, or an option for a kind to say "my content scrolls itself" (no outer scroller).

26. **The tab's title isn't a public part.** A tab's lamp (Studio's `::before`) took room from the title, which then ran under the close button. Studio reaches the title as `.jali-tab .jali-tab-title` to make it shrink. Want: `.jali-tab-title` public, and the tab's room for its buttons guaranteed whatever the app adds.
27. **A pane can't render a designed state for an object Jali can't read.** A link naming a session that doesn't exist reaches the component (the param is a valid string), so the app draws its own "no signal" state. A link with a param Jali can't read gets Jali's own message instead, which the app can't style or give a recovery key. Want: a kind-level `Missing` component, like `Loading`, used for both.

28. **The doubled ring on transcript rows was Studio's, not Jali's.** It came from Studio's own rule for a selected row in a focused pane (`[data-active]`), which fired after a click as well as from the keyboard. Jali draws no ring on rows; its focus mark is on the pane (`[data-focused]`). Nothing to change in Jali here; noted so the next reader doesn't look for it there.

29. **A light and a dark finish need different shadow strengths, and Jali's shadow tokens are fixed strings.** Studio scales every dark shadow by its own `--sh` number per theme; Jali's `--jali-shadow-*` tokens take one value each, set as `light-dark()` colours inside, which can't scale an offset or a blur. Want: shadow tokens built from a few parts (`--jali-shadow-color`, `--jali-shadow-strength`) or one per theme scope, documented.

Not Jali's, for the record: making the top row one flex row of blocks meant grouping elements in `display: contents` wrappers that keep their roles (`navigation` "Layouts", `group` "Transport", "Tools"). Chrome exposes those roles; it is worth testing in other browsers before relying on it.

## What worked

- **Following a moment in time.** The playhead lives in the app's engine, not in Jali. Panes read it with `usePosition(paused)` or `useFrame(paused, draw)`, and `paused` was exactly the signal needed: a folded, tabbed, tucked or zoomed-past pane stops drawing, and the sound goes on.
- **Followers of several kinds.** One `follow` function shared by the transcript, timeline, mixer and markers kinds, and one `select(transcript({ session }))` from the library. A second list (the transcript) drives its own follower, and a kept detail beside a following one makes Compare.
- **A list's cursor in Jali's selection.** Reading `useJaliState((s) => s.selection[node.id])` let ⌘K commands ("Go to segment…", "Open session…") move a list's cursor with `jali.actions.select`, with no app state of their own.
- **Unsaved work and pane state.** `usePaneState` for the draft and `useUnsaved` for the question: a layout without the transcript asks, a layout with it carries the draft across, and a reload keeps it.
- **Commands.** `createJali({ commands, keymap })` and `jali.actions.choose` made "Go to segment…", "Jump to marker…" and "Playback speed…" a few lines each, searchable by any word of the line.
- **Fit or fold.** Honest minimum widths, and `priority: "supporting"` on the markers in Review, were enough for every layout to fold sensibly down to a phone, where `phone: { stack: true }` shows the library over the transcript.
- **Theming.** The hardware look came from Jali's tokens and the public part selectors, with no `!important` (see above for the few rules that reached further).
