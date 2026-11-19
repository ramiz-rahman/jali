# Split view on phones and foldables

Research note, 19 Nov 2026. Question: should Jali show more than one pane on a phone, and how should it handle foldables?

## Recommendation

Yes, but deliberately, and in a narrow form. Today's phone rule is not really a phone rule. It is a side effect of the fit, and on real phones it behaves inconsistently. Replace it with an explicit decision, made in `@jali/core` from the workspace's size, in three steps:

1. **A width class decides the regime, not "a pane overflowed".** Below 600 CSS px of workspace width (Android's compact width, which covers 99.96% of portrait phones), Jali is in the **phone regime**: Single view by default, whatever the kinds' minimums are. At 600 px and above, today's fit applies unchanged, including today's "even one pane overflows, so go single" fallback.
2. **Stacked view is opt-in, for the candy-bar phone.** An app that opts in (`createJali({ phone: { stack: true } })`) gets a third presentation in the phone regime: two panes, one above the other, chosen from the link graph (a pane and the pane it follows, so a list above its detail, a chart above its table). Never more than two. Only in portrait-shaped space (height ≥ 480 px and both panes at or above their `minHeight`). Kinds can refuse it (`phone: { stack: false }`) or say which half they want.
3. **A separating hinge becomes a locked divider.** When the browser reports two viewport segments that cross the workspace (a half-open Fold in book or tabletop posture, a spanned Surface Duo, a Flip in flex mode), Jali places its divider on the hinge and fits each side on its own, so no pane straddles the fold. This is on by default, because it only ever fires on hardware with a separating fold, and a pane split by a hinge is never what anyone wants.

All three are derived on every render, like `m.single` is today. Layout, URL and history stay untouched; leaving the phone regime restores the wide arrangement exactly as `restoreWide` does now. Default behaviour on a phone becomes Single view, which is what the docs already promise ("On a phone, the workspace shows one pane at a time").

## What Jali does today, measured

The rule lives in `buildModel` (`packages/core/src/state/model.ts`): `single` is true when, after `resolve` has folded everything it can, a visible pane's rect still runs past `area.width`. `resolve` folds until both width and height fit (`tooSmall` in `layout/fit/context.ts`), and a fold group's minimum is its widest tab. `@jali/react` reads `m.single` and switches to `Presentation = "single"` (`CHROME.single`: no drag, zoom or tuck), shows `PaneSwitcher`, hides dividers and the shelf, and makes Peek a full-width sheet (`Workspace.tsx`, `useSingleView.ts`).

Only width triggers it. I ran `resolve` against the test fixture kinds (list 320×120, inspector 280×100, record 480×200) at real phone sizes (workspace area is viewport minus 12 px):

| Layout                   | 390×844 portrait (378×832)    | 844×390 landscape (832×378)      | 320×568 (308×556) |
| ------------------------ | ----------------------------- | -------------------------------- | ----------------- |
| column: list / inspector | **tiled, two panes 378×413**  | tiled, two panes 832×186         | single            |
| row: list / inspector    | folded to one tab group       | tiled side by side, 413×378 each | single            |
| column: list / record    | **single** (record's 480 min) | tiled, 832×172 + 832×200         | single            |

So on a 390 px phone the answer depends on whether any shown kind's `minWidth` is over about 378 px. With the default minimum (240) or typical kinds (280–360), a phone already gets a top/bottom split, rendered with desktop chrome: 6 px gaps, island borders, draggable headers, zoom, a 12 px divider hit area. One wide kind flips the whole workspace to Single view. In landscape it happily stacks two 186 px slivers. None of that was designed; it falls out of the fit. The founder's instinct is right that stacking can be good, but the first job is to make it a decision rather than an accident.

## Evidence: what platforms and apps do

**Android.** Window size classes are computed from the window, not the device, separately for width and height: compact width < 600 dp, medium 600–840, expanded 840–1200; compact height < 480 dp covers 99.78% of phones in landscape. Google's note: in landscape phones and open flippables "the window width is typically medium, but window height is compact, in which case two pane layouts are not practical" ([window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes)). Material 3's list-detail scaffold shows panes side by side in large windows and "only one pane is visible at a time" in small ones; it supports up to three panes (list, detail, extra) ([list-detail](https://developer.android.com/develop/ui/compose/layouts/adaptive/list-detail)). The scaffold's directive carries `maxHorizontalPartitions`, `maxVerticalPartitions` and `excludedBounds` (hinge areas), with hinge policy `AvoidSeparating` by default ([PaneScaffoldDirective](https://composables.com/jetpack-compose/androidx.compose.material3.adaptive/adaptive-layout/functions/calculatePaneScaffoldDirective)).

Foldables: Jetpack WindowManager reports a `FoldingFeature` with `state` (FLAT / HALF_OPENED), `orientation`, `occlusionType` and `isSeparating`. Tabletop = half open with a horizontal hinge (content above, controls below); book = half open with a vertical hinge (two pages). Guidance is to use the hinge as a natural separator, keep controls away from it, and never put content inside an occluding hinge; dual-screen devices count as separated even when flat ([fold-aware apps](https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware)).

**Apple.** iPhones are compact width in portrait; `UISplitViewController` collapses to one column there. Plus/Max iPhones report regular width and compact height in landscape, which is why Mail and Settings show two columns on a Max held sideways ([size class reference](https://useyourloaf.com/blog/size-classes/)). iPhone has no multi-app split. On iPad, iPadOS 26 replaced classic Split View and Slide Over with windowing, then brought a Split View back inside windowed apps ([9to5Mac](https://9to5mac.com/2025/06/09/psa-ipados-26-removes-split-view-and-slide-over-multitasking-features/), [Cult of Mac](https://www.cultofmac.com/how-to/how-to-use-split-view-in-ipados-26)).

**Samsung.** One UI supports top/bottom split on ordinary Galaxy phones, with a draggable divider and pop-up windows, but not on the Fold/Flip cover screens ([Samsung support](https://www.samsung.com/us/support/answer/ANS10002022)). So a top/bottom split on a candy-bar phone is a real, shipped pattern, but at the OS level, for two whole apps, used by a minority.

**Apps (observed, not from documentation).** Gmail, Outlook, Telegram and Slack are single pane on phones and become list-detail on tablets and an open Fold. The common stacked pattern on phones is something else: a fixed viewer above and a scrolling or acting region below. YouTube puts the video above the list; Maps puts the map above a draggable bottom sheet; trading apps put the chart above positions or the order ticket. These are fixed or snap-ratio regions, two at most, with the thumb-reachable bottom half doing the scrolling and tapping. Spreadsheets, code editors and Figma on phones fall back to one view with a switcher, much like Jali's Single view.

Read together: everyone goes to one pane at compact width by default; the exceptions are two-region compositions of a viewer and a companion, in portrait; and every foldable platform treats the hinge as a boundary.

## Evidence: the web platform

- **Viewport Segments** shipped in Chrome and Edge 138 (June 2025), desktop and Android. Not in Firefox or Safari ([Chrome blog](https://developer.chrome.com/blog/viewport-segments-api-shipped?hl=en), [intent to ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/pxWV6Es3T0Q)). CSS: `@media (horizontal-viewport-segments: 2)` for side-by-side, `(vertical-viewport-segments: 2)` for stacked; `env(viewport-segment-width 0 0)` and `-height`, `-top`, `-left`, `-bottom`, `-right`, indexed (x, y), so `0 1` is the bottom segment. JS: `window.viewport.segments`, an array of `DOMRect`; one rect for the whole viewport when the device is not folded or cannot fold ([MDN guide](https://developer.mozilla.org/en-US/docs/Web/API/Viewport_segments_API/Using)). Segments are in viewport coordinates; update on `resize`.
- **Device Posture API** shipped in Chrome 132 (Jan 2025), Android and Windows only; `navigator.devicePosture.type` is `"continuous"` or `"folded"`, with a `change` event and `@media (device-posture: folded)` ([web-features](https://web-platform-dx.github.io/web-features-explorer/features/device-posture), [intent to ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/Xbhdn0u6Z9A)). It says the device is bent, not which way; segments say where.
- **Emulation.** CDP has `Emulation.setDisplayFeaturesOverride` (feeds the segments API) and `Emulation.setDevicePostureOverride`, both experimental, plus `clear…` counterparts ([CDP Emulation](https://cdpstatus.reactnative.dev/devtools-protocol/tot/Emulation)). Playwright reaches them through `page.context().newCDPSession(page)` on Chromium. DevTools' device toolbar can emulate dual-screen and foldable devices with a posture control; MDN notes such emulation does not reproduce the physical segmentation, so a real device check is still needed. Check the exact parameter shapes in the protocol viewer before writing the helper (I expect `{ features: [{ orientation, offset, maskLength }] }` and `{ posture: { type } }`).
- **On-screen keyboard.** Chrome on Android defaults to `interactive-widget=resizes-visual`: the keyboard shrinks only the visual viewport, so Jali's `ResizeObserver` never fires and the keyboard simply covers the bottom pane. `resizes-content` (Chrome 108+, Firefox 132+) shrinks layout instead; iOS overlays the page regardless ([Chrome blog](https://developer.chrome.com/blog/viewport-resize-behavior), [MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Viewport_meta_element)). Either way the keyboard takes roughly 40–50% of a portrait phone's height.

## Usability constraints for top/bottom on a candy-bar phone

- **Height.** A 390×844 phone in a browser leaves roughly 650–750 px after browser chrome. Minus the 44 px switcher and a host bar, two panes get about 280–330 px each. A pane header (about 40 px) takes an eighth of that. A useful floor per stacked pane is about 200 px of body; below it, stacking is worse than switching. Jali's default `minHeight` of 160 is a desktop figure; the phone regime should apply a floor of `max(kind.minHeight, 200)` for stacking.
- **Keyboard.** When a field in either pane has focus and the visual viewport drops below what two panes need, show the focused pane alone until the keyboard closes. Do not refold, do not touch layout, announce once at most. Without this, the bottom pane's input sits under the keyboard.
- **Landscape.** Compact height (< 480) never stacks. A large phone in landscape is usually 600+ wide, so it falls into the split regime and today's fit shows side-by-side panes, which matches iPhone Max behaviour. But the fit must stop producing stacked slivers there: in compact height, a column split's children need the same 200 px floor, so a landscape column folds instead of showing two 186 px strips.
- **Thumb reach and order.** The bottom half is the easy half. Default order is reading order of the pair (the pane followed above, the follower below), so a list sits above its detail. A kind can ask for `place: "bottom"` (an order ticket, a table) or `"top"` (a chart, a map, a player).
- **Touch targets and the divider.** WCAG 2.5.8 asks for 24×24 px minimum; Apple 44 pt; Material 48 dp. The visual divider can stay at the 6 px gap, but on `(pointer: coarse)` its hit area should grow to at least 44 px tall (today it is 12 px). Snap the ratio to 1/3, 1/2, 2/3; dragging past a third of the way to an edge drops to Single view with the other pane. A divider on a hinge is not draggable.
- **How many panes.** Two. Three stacked panes on a phone give each about 200 px, which is a strip, not a view.
- **Tabs, shelf, peek.** In stacked view each pane gets the single-view chrome (`CHROME.single`: no drag, zoom or tuck) plus a compact header with its title and an "expand" action that shows it alone. No tab strips; the switcher at the top still lists every pane and marks the two in view. The shelf stays hidden as in Single view. Peek stays the full-width bottom sheet it is in Single view.

## The proposal for Jali

### Core: one decision, derived

Add a pure `presentationOf` in `@jali/core` (next to `workspace/single-view.ts`) and have `buildModel` call it. It takes what the model already has plus two new inputs: the phone policy from `Env` and the segments that cross the workspace.

```ts
type Presentation =
  | { mode: "split"; regions?: [Rect, Rect] }        // today's tiled render; regions only when a hinge splits it
  | { mode: "stacked"; top: NodeId; bottom: NodeId; ratio: number; locked: boolean }
  | { mode: "single" };

interface PhonePolicy {
  below: number;          // phone regime under this workspace width; default 600; 0 = today's rule only
  stack: boolean;         // allow stacked view in the phone regime; default false
  stackFloor: number;     // minimum pane body height when stacked; default 200
  fold: boolean;          // honour viewport segments; default true
}

presentationOf(input: {
  layout, view, area, ctx, env, segments: Rect[]   // segments already clipped to the workspace
}): Presentation
```

The order of the decision:

1. **Two segments cross the workspace** (and `fold`): take the hinge rect (zero-width for a seamless fold, the mask for a Duo). If the layout's root is a split along the hinge axis, give each side the root children whose natural extent lies on that side; otherwise put the focused pane on one side and its link partner on the other. Fit each side with `resolve` against its region. If a side's pane still overflows its region, that side shows single. Result: `split` with `regions`. In the phone regime with a horizontal hinge (Flip flex mode, tabletop) this becomes `stacked` with `locked: true`, which ignores `stack` because the hardware has already made two screens.
2. **Width under `below`**: if `stack`, the focused pane has a link partner, neither kind says `stack: false`, `area.height ≥ 480` and both get `≥ stackFloor`, return `stacked`. Otherwise `single`.
3. **Otherwise** today's fit, with the compact-height floor for column splits, and today's overflow fallback to `single`.

`m.single` stays as `presentation.mode === "single"` so nothing that reads it breaks. `Presentation` in `pane/chrome.ts` gains `"stacked"`, mapped to the single chrome. The stacked ratio is UI state in the store (`ui.stackRatio`, session only), not layout, not URL. Segments enter through the store like `area`: `@jali/react` reads `window.viewport?.segments` on resize and on `devicePosture` change, intersects them with the workspace element's rect, and sets `segments` only when two or more cross it. A browser without the API simply never reports segments.

`restoreWide` keeps working unchanged: it already snapshots on the last wide render and restores on leaving. The trigger becomes "leaving the phone regime" instead of "leaving single".

### Kinds and the app

```ts
createJali({
  kinds,
  phone: { stack: true }, // opt in to stacked view; below, stackFloor, fold keep defaults
});

definePane({
  kind: "chart",
  width: { min: 320 },
  height: { min: 220 },
  phone: { place: "top" }, // or "bottom"; stack: false keeps this kind out of stacked view
  render: ChartPane,
});
```

`phone` on a kind is a hint about phones only; `height.min` keeps its meaning everywhere. Pairing uses the existing links (`linkedTo`, the opened-from relation the fit already protects), so an app gets list-above-detail without declaring pairs.

### Accessibility

- Announce entering and leaving each presentation once, through the existing announcer: "Two views stacked: Orders above, Order 1042 below", "Split at the fold", "Single view: one pane at a time". Suppress fold announcements while in the phone regime, as today.
- Focus never moves on a presentation change; the focused pane is always one of those shown (it decides the pair).
- The stacked divider keeps the separator semantics and arrow-key resizing of today's dividers; a locked hinge divider is not focusable.
- The switcher marks both shown panes with `aria-current`, and choosing one outside the pair shows it with its own partner, or alone.

### Migration

The default changes in one place: a phone-width workspace whose kinds are narrow enough to tile will now show Single view instead of desktop-style tiles. That is a fix, since the docs already promise one pane on a phone, but note it in the changelog and offer `phone: { below: 0 }` for anyone who wants today's exact behaviour. Stacked view is off until an app asks. Fold handling is on, and only ever changes anything on a device that reports a separating hinge. Nothing saved, linked or in history changes shape.

## Test plan

**Unit tests in core** (`presentationOf`, plain areas, no DOM), using the fixture kinds:

- 378×832, `stack: false`: always `single`, including the list/inspector column that tiles today.
- 378×832, `stack: true`, list with a linked inspector: `stacked`, list on top; with `place: "top"` on the inspector, order flips; with `stack: false` on either kind, `single`; with no link partner, `single`.
- 378×400 (keyboard-sized), `stack: true`: `single`, and the focused pane is the one shown.
- 832×378 landscape: `split`, row tiles side by side, a column of two folds (compact-height floor).
- 308×556 (320×568 phone): `single`, panes never narrower than `minWidth`.
- 678×828 (Fold inner, flat): `split`, today's fit.
- Segments: two side-by-side 339 px regions with a 0 px hinge; Duo two 540×720 with a 28 px mask; Fold tabletop 840×~410 over 840×~410; Flip flex mode ~412×~450 twice. Check every pane rect lies inside one region, the divider sits on the hinge and is marked locked, and a row root splits by its children.
- `below: 0` reproduces today's `single` for every case in the existing test suite.
- Model identity: the same inputs give the same presentation object (extend `modelCache`'s key with `segments` and the policy).

**Playwright e2e** (extend `e2e/responsive.spec.ts`), at 390×844, 360×780, 320×568, 844×390, the Fold inner ~690×840 (deviceScaleFactor 2.625) and a Flip inner ~412×915:

- No sideways scroll anywhere (the existing assertions).
- Default app: one pane plus switcher on every phone size; widening restores the exact arrangement (existing test).
- Stacked app: two panes at 390×844; divider hit area ≥ 44 px on a touch context (`hasTouch: true`); drag snaps; dragging to an edge goes single; focusing an input and shrinking the viewport to about 390×450 shows that pane alone and restores on growing back; rotate to 844×390 and get side by side, no slivers.
- Foldables via a CDP helper on Chromium: set display features (vertical at offset 345, then horizontal), set posture `folded`, assert no pane's bounding box crosses the hinge, assert the announcement text, then clear both and assert the normal fit returns.
- Axe and the a11y spec on stacked and fold states.
- One manual pass on a real Fold or Flip before calling fold support done, since emulation does not model the physical seam.

## Risks, and what to defer

**Risks.**

- The default change at phone width will surprise anyone who relied on accidental tiling. Mitigation: `below: 0`, a changelog line, and the docs already describe the new behaviour.
- Segments are Chromium-only. Fold support is progressive: Safari and Firefox get the plain size rules, which are still correct, just not hinge-aware.
- Segments are viewport coordinates; a workspace that does not fill the viewport (a host header, a docs page with three workspaces) must clip them, and a hinge that only grazes the workspace edge should be ignored. Get this wrong and panes jump.
- Rotation, keyboard and posture changes can fire in quick succession. Announce on settle, not on every resize, or screen-reader users hear a burst.
- A third presentation adds paths through `frames`, the switcher, Peek and focus. Keep stacked view as "single view showing two frames" internally, not as a new tiled mode, so it inherits single view's rules.

**Defer.**

- Posture-specific layouts beyond segments (media controls in tabletop, two-page reading in book). Segments already give the geometry; content can use `useDevicePosture` later if an app asks.
- Stacking in landscape, three panes on a phone, and persisting the stacked ratio across sessions.
- Dragging panes across a hinge, or letting the person move the hinge divider.
- Android-style Back semantics in the phone regime (Back from a detail to its list). Jali deliberately leaves history alone today; revisit with real phone use, because it is the first thing Android users will expect.
- Using pointer type for anything other than hit areas. Layout decisions stay on size, as Android advises against device-type logic.
