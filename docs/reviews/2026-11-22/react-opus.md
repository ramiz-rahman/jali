# @jali/react: architecture and code review (Opus, 22 Nov 2026)

Repo: `review-93526af` (frozen, read-only). Every "verified" finding was reproduced with a throwaway Vitest file run against the repo's source from a scratch harness (`scratchpad/vt/tests/review*.test.tsx`; no file in the repo was touched). "Read" means I found it in the source but did not run it.

## Verdict

@jali/react is already close to the bar on the hard parts. One external store with narrow `useSyncExternalStore` selectors, and render counts held by tests. A Suspense boundary and an error boundary per pane. SSR hydration tested on React 18 and 19. In-house APG primitives (roving row, modal dialog, menu) that are small and mostly correct. A real parts contract with tokens in `@layer jali`.

What keeps it short of Radix, React Aria or TanStack is the React-specific layer:

- Pane content remounts when its frame changes parent: a scrolling row flipping to single view, which is verified, and pop out.
- `useJaliState` has no equality function, so the natural `s => ({…})` selector crashes the app (verified).
- Host code in a header (`useHeaderActions`) sits outside every boundary, so one throw unmounts the whole workspace (verified).
- Two workspaces on a page share DOM ids by default, so the ARIA references between them cross (verified).
- There is no `"use client"`, so Next.js App Router can't import the package.
- The "compose your own" exports are a half-supported second root.

None of these needs a rewrite. They need a stable host node per pane, selector equality, two more boundaries, a DOM scope from React, and a smaller public surface.

## Target architecture: where it should differ from today

1. **A persistent host node per pane, one flat keyed list.** `Panes` renders every `PaneFrame` as a sibling in one keyed list, whether the pane sits in a strip or not. A `Strip` positions frames and does not parent them; that means the strip's scrolling content becomes an overlay that frames are placed into by coordinates. Pop out _moves_ the pane's existing content element into the floating window rather than rendering a second tree. Today two tree positions (`Workspace.tsx:368-400`) and two render branches in `PaneFrame.tsx:243-274` throw component state away.
2. **Selector hooks with equality, for state and the model.** `useJaliState(select, isEqual = Object.is)`, `useJaliModel(select?, isEqual?)` and an exported `shallow`. These are the same shape as TanStack Store and Zustand's `useStoreWithEqualityFn`. The internal `useModelValue` and `useEntriesOf` already prove the pattern.
3. **Boundaries around everything the host supplies.** The pane's boundary also wraps its header controls. `<JaliRoot>` gets one chrome boundary for the rest of the host's code: icons, `Rail`, `Header`, `settingsExtra`, kind `icon`. A chrome failure then degrades one pane or one part, never the workspace.
4. **One root and opt-in modules instead of loose parts.** `<JaliRoot>` stays the only root. `Palette`, `SettingsPanel`, `Chooser`, `ConfirmDiscard`, `Announcer` and `Panes` become internal. Optional features arrive by import and are passed in, so they tree-shake: `<JaliRoot modules={[settings, chooser, popOut]}>`, or `createJali({ adapters })` through the `DomPort` that already exists. This is the same move `definePage` made for the curated page.
5. **React owns the DOM scope and the accessible name.** The DOM-id prefix falls back to a `useId()`-derived scope whenever another mounted root already uses the same `store.dom.id`, plus a dev warning. `<JaliRoot aria-label | aria-labelledby>` overrides `createJali({ label })` at render time, so the name can be translated and can point at a visible heading.
6. **A package that works in every React host.** The build adds a `"use client"` banner. The dev check reads `process.env.NODE_ENV`, not `import.meta.env`. There is a documented `useState(() => createJali(...))` plus `destroy`, or a `useCreateJali` hook, with SSR guidance (`memoryLocation(request.url)`).
7. **Styles dogfood the contract.** Jali's CSS selects on its own public attributes (`[data-focused]`, `[aria-selected]`), not on duplicate `is-*` classes. Jali writes its resolved theme as `data-jali-theme`, not the host's `data-theme`, which removes the `:not(:root[data-theme] :is([data-jali],[data-jali-layer]))` gymnastics in `jali-theme.css:24-39` and `jali-tailwind.css:26-33`.

## Findings (ranked)

Severity: P0 is a bug, crash or a11y blocker; P1 is serious; P2 is before 1.0; P3 is polish. Effort is S, M or L.

### REACT-1 · P1 · Pane content remounts when single view flips or a pane enters or leaves a scrolling row (QUALITY-REVIEW P12, never closed) · verified · M

**Evidence:** `Workspace.tsx:368-381` renders non-strip frames under `.jali-workspace-inner`, and `:384-400` renders strip frames under `<Strip>`. Single view renders every frame in the first list. React keys only work among siblings, so a frame changing parent remounts.

**Repro:** a row of `day` panes under `row({scroll:"x"})`. Click a `useState` counter to 1, then let the area drop to 400px (single view). Result: `remounted: ["d1","d2","d3","d4"]`, and the counter reads 0. A phone rotation or a narrowed window loses drafts held in `useState`.

**Fix:** one flat keyed list of `PaneFrame`s (target 1). `Strip` keeps the scrolling element and its chrome, and frames are placed into its content box by absolute coordinates. They can still be DOM children if the strip renders them through a portal into its content element, which keeps one React parent: a portal's position in the React tree is stable. Add a render test: a pane's state survives single ⇄ tiled and moves into and out of a strip.

### REACT-2 · P1 · `useJaliState` crashes on an object-returning selector, and has no equality function · verified · S

**Evidence:** `state/react.tsx:35-40, 163`. Each read returns a new object, so `useSyncExternalStore` loops.

**Repro:** `useJaliState(s => ({ f: s.view.focused }))` gave "The result of getSnapshot should be cached…" and then threw "Maximum update depth exceeded". This is the first thing a TanStack or Zustand user writes.

**Related:** `useJaliModel` (`:165`) takes no selector at all, so every caller re-renders on every model change, including live titles. Trips' map pane (`examples/trips/src/panes/map.tsx:258`) and `day.tsx:107` pay for this. Trips' `useCurrent` reads `jali.model()` inside a state selector to get around it (`examples/trips/src/selection.ts:9-14`).

**Fix:** `useJaliState(select, isEqual?)` and `useJaliModel(select?, isEqual?)`, both caching the last selection by `isEqual` (the `useDerived` cache in `state/react.tsx:78-101` already does this), plus an exported `shallow`. Throw a dev-only error that names the fix when two consecutive reads differ for an unchanged state.

### REACT-3 · P1 · A throw in the host's header controls (and any Jali chrome) unmounts the whole workspace · verified · S

**Evidence:** `PaneBody.tsx:123-142` renders `<HeaderControls>` as a sibling of `<PaneBoundary>`, not inside it. `HeaderControls` (`header.ts:58-61`) portals host JSX into the header. `<JaliRoot>` has no boundary at all.

**Repro:** `useHeaderActions(<Boom/>)` in pane 2 made `render` throw "control boom", and pane 1 was gone too. The same happens if a header control suspends: it suspends to whatever Suspense the host has above `<JaliRoot>`, or to none.

**Fix:** move `HeaderControls` inside the boundary's tree. One option is `PaneBoundary` rendering `{children}{headerControls}` inside its Suspense. Another is a second small boundary that reports to the same pane failure. Add a chrome boundary in `JaliRoot` around the root's children and the layer, with `onError` reaching `env.onPaneError` or a new `onError`.

### REACT-4 · P1 (a11y) · Two workspaces share DOM ids unless the host passes `id`, so `aria-labelledby` and `aria-controls` cross workspaces · verified · S–M

**Evidence:** core defaults the DOM prefix to `"jali"` (`packages/core/src/create-jali.ts:76`, `state/store.ts:450`). React builds every id from it:

- `paneDomId` and `paneTitleId` in `PaneFrame.tsx:112-117, 196`;
- `aria-controls` in `TabStrip.tsx:239` and `SwitcherItem.tsx:47`;
- the dialog ids in `ConfirmDiscard.tsx:33-37` and `Settings.tsx:38-41`.

**Repro:** two `<JaliRoot>`s gave axe `duplicate-id` (`jali-pane-a`, `jali-pane-a-title`, …) and `landmark-unique: 2`. With `label` set on both, `landmark-unique` passes but `duplicate-id: 3` remains.

**Consequence:** in the unnamed case, the second workspace's panes are labelled by the _first_ workspace's titles, and its tabs control the first workspace's panes. That is a WCAG 4.1.2 failure in a default configuration. Storage and the address collide the same way, which is core's problem; only the DOM half is React's.

**Fix:** in `@jali/react`, keep a per-document registry of mounted roots. If another root already uses `store.dom.id`, scope the DOM ids with `useId()` through a new `store.dom.use(reactDom, { scope })`. Ids are never persisted, so this is safe. Also `console.error` in development: "two workspaces share id 'jali': pass createJali({ id, label })". Add an axe test with two default workspaces. See gap (a) below.

### REACT-5 · P1 · Not importable from a Next.js App Router server component: no `"use client"` · read · S

**Evidence:** `packages/react/vite.config.ts` (`pack` has no banner) and `src/**` contain no directive, yet every entry calls `createContext` at module scope (`state/react.tsx:17`, `icons/context.tsx:4`, `pane/context.ts:34`).

**Comments that overclaim:** `state/react.tsx:38` says "a workspace renders with server rendering (Next.js, Astro)", and the docs have no SSR guide. A user who renders `<JaliRoot>` from a page gets "createContext is not a function".

**Fix:** a `banner: '"use client";'` on the `index` and `icons` entries, and a docs page for Next and Astro. That page covers: `"use client"` boundaries; creating the workspace per request or per mount (`useState(() => createJali(...))`, `destroy` on unmount); and `url: { location: memoryLocation(request.url) }` on the server so a linked layout doesn't mismatch on hydration.

### REACT-6 · P2 · Settings' pane cap can't be typed: each keystroke is clamped and applied · verified · S

**Evidence:** `dialogs/Settings.tsx:84-95`, `set({ paneCap: Math.max(2, Math.min(16, Number(v) || 8)) })` on every `onChange`.

**Repro:** typing "1" set the cap to 2, so the whole workspace refolds to two panes while the person types. Typing "2" next gave "22", clamped to 16. Any value from 10 to 16 is impossible by keyboard, and clearing the field jumps to 8.

**Fix:** keep the draft in local state and commit on blur or Enter (or a valid in-range value). Keep `min`, `max` and `step` for the spinner, and set `aria-invalid` while the draft is out of range.

### REACT-7 · P2 · Jali's buttons have no `type`, so inside a host `<form>` they submit it · verified · S

**Evidence:** about 25 buttons, among them:

- `HeaderActions.tsx:115, 133, 147, 167, 196, 223`
- `TabStrip.tsx:286, 298, 362`
- `Shelf.tsx:170, 194, 243, 264`
- `Peek.tsx:103, 112, 120`
- `ConfirmDiscard.tsx:48, 55`
- `PageBar.tsx:38, 47, 64, 70, 145`
- `Settings.tsx:42`, `SwitcherItem.tsx:42`, `TabOverflow.tsx:73, 130`

`IconButton` and `TabMenu` do set it.

**Repro:** the close button has `.type === "submit"`, and clicking it called the host form's `onSubmit` once.

**Fix:** add `type="button"` everywhere, plus a source-level test like `parts.test.tsx` that fails on a bare `<button`.

### REACT-8 · P2 (a11y) · An empty ⌘K or chooser list fails axe: an `<li>` inside `role="listbox"` · verified · S

**Evidence:** `dialogs/ListDialog.tsx:127`.

**Repro:** palette with a query matching nothing gave axe `aria-required-children: 1` and `listitem: 1`. `e2e/axe.spec.ts` only scans a non-empty palette.

**Fix:** render the empty message outside the `ul`, as `role="status"` so it is announced. Also add `aria-autocomplete="list"` to the combobox (`:74-100`).

### REACT-9 · P2 (a11y) · The page bar's view-mode `radiogroup` has no arrow keys and two tab stops · read · S

**Evidence:** `chrome/PageBar.tsx:37-56`. APG radio group: one tab stop, with ←/→/↑/↓ moving and checking. The disabled "Split view" radio is also unfocusable, so its reason (`splitTipLimited`) is unreachable.

**Fix:** `useRovingKeys` with a `move` that checks (it already supports a selecting `move`), `tabIndex` on the checked radio only, and `aria-disabled` instead of `disabled`.

### REACT-10 · P2 (a11y) · Tabs control a `region`, not a `tabpanel`, and the shown tab controls its own ancestor · read · S

**Evidence:** `TabStrip.tsx:239` sets `aria-controls={paneDomId(...)}`, which is the pane's `<section role="region">` (`PaneFrame.tsx:110-117`). For the shown tab, that section _contains_ the tablist. No element has `role="tabpanel"`, so the APG tabs pattern is incomplete: screen readers don't announce a panel for the tab, and "go to controlled element" lands on the header.

**Fix:** when a frame has a group, give `.jali-pane-content` `role="tabpanel"`, an id, and `aria-labelledby` set to the shown tab's id. Point `aria-controls` there. The region and landmark stays on the section.

### REACT-11 · P2 · Pop out is not stable (gap b); four bugs on top of the known limits · verified · M–L

These are verified with a fake `documentPictureInPicture` in jsdom:

- **State is lost:** a counter at 2 reads 0 in the floating window. `PaneFrame.tsx:243-274` renders `PaneBody` in two different tree positions.
- **Orphan window:** unmounting `<JaliRoot>` while popped out leaves the window open with stale DOM, and module `current` still points at a dead store (`PopOut.tsx:31-37, 155-161`). There is no cleanup on unmount or `destroy()`.
- **The doc comment is false:** `popOut` rejects on a refused `requestWindow` (no user activation gave `NotAllowedError`, thrown). The comment says it "resolves `false` where the browser can't" (`PopOut.tsx:65-68, 84`). `reactPopOut.run` and `TabMenu`'s `void popOut(...)` (`TabMenu.tsx:41`) then leave an unhandled rejection.
- **Theme and tokens are a one-time copy of `<html>` only** (`PopOut.tsx:42-63`). The window root lacks `[data-jali]`, so tokens a host set on `<JaliRoot>` or a wrapper, the `ThemeOnRoot` `data-theme`, the workspace's own `dir` (`createJali({ dir })`) and later theme switches don't reach it. `document.title` is set once (`:108`) and doesn't follow `useTitle`.

The known limits remain: keys don't reach the window, and there is no way back for the content's own state. Fix plan under gap (b).

### REACT-12 · P2 · The "compose your own" path is a second, weaker root · read · M

**Evidence:** `index.ts`/`common.ts` export `JaliProvider`, `Panes`, `Palette`, `SettingsPanel`, `Chooser`, `ConfirmDiscard` and `Announcer` "to compose your own". The documented sample (`apps/docs/src/samples/reference/compose.tsx:12-25`) must import `storeOf` from `@jali/core/adapter` and call `dom.attach` itself. It then silently loses what `JaliRoot.tsx:87-135` does:

- the dialog layer (`data-jali-layer` and `attachLayer`), so menus portal to `body` (`Menu.tsx:116`), scoped keys don't count the dialogs as inside, and `ModalDialog` inerts nothing correct;
- `--jali-gap` and `--jali-inset`;
- `dir`;
- the full-screen portal;
- `installPressed`;
- the inert `overlays`;
- `ThemeOnRoot`.

No example uses this path.

**Fix:** make those parts internal (the surface goes from 41 to about 34 values). Keep `<JaliRoot>` with slots (`children` plus `<JaliView/>`, `overlays`, `settingsExtra`, and a `modules` or `dialogs` prop per target 4). If composing must stay, export a `<JaliLayer>` and a `useJaliRootProps()` that carry every root duty.

### REACT-13 · P2 · Two `definePage`s; the core one silently renders no page in React · read · S

**Evidence:** `@jali/core` and `@jali/react` both export `definePage`. Core's returns a page without `[PAGE_PARTS]`. `JaliView` (`JaliRoot.tsx:193-197`) then shows `<Panes/>` while `state.page` is open, with no warning: no rail, header or tabs.

**Fix:** rename core's to an adapter-only name (`definePageEngine` in `@jali/core/adapter`), or have `JaliView` throw in development when a page is open without parts: "import definePage from @jali/react".

### REACT-14 · P2 · First 30 minutes: the zero-height warning only fires under Vite · read · S

**Evidence:** `Workspace.tsx:33` (`DEV` from `import.meta.env`) and `:73-78`. Under Next, webpack, Parcel or Rspack, `import.meta.env` is undefined, so the most common first-run failure (a root with no height, every pane collapsed) is silent.

**Fix:** `process.env.NODE_ENV !== "production"`, which every bundler replaces. Use the same check for the new dev warnings in REACT-2, REACT-4 and REACT-13.

### REACT-15 · P2 · Ergonomics against TanStack: typed pane hooks, and events in React · read · S–M

**Evidence:**

- `usePane<P>()` is an unchecked cast (`pane/hooks.ts:36-38`). A component below the kind's restates the params type by hand.
- Toasts are `jali.onToast` and every other event is `jali.on(...)`, so each app writes the same effect (`examples/*/src/shell/App.tsx`).
- `useTheme` and `useShortcut` are unprefixed and collide with next-themes and MUI names in host code.
- `keyBelongsToContent` is framework-free but lives in `@jali/react` (`keys.ts`).

**Fix:**

- `usePane(note)`, which takes the definition and infers `params`.
- `useJaliEvent(name, handler)`, which takes the latest handler and unsubscribes on unmount, with toast as one of the events.
- Rename to `useJaliTheme` and `useJaliShortcut` while pre-1.0 is the cheap time.
- Move `keyBelongsToContent` to core and re-export it.

### REACT-16 · P2 · Bundle: a credible path from 24.5 to about 17–18 KB gz, not to "much smaller" · measured roughly · M

**Measurement:** rolldown, pre-minify module sizes for the full `index.ts`. The largest are:

| Module                                    | Size (bytes) |
| ----------------------------------------- | ------------ |
| `Workspace`                               | 13.2k        |
| `TabStrip`                                | 11.9k        |
| `PageBar` (already opt-in)                | 10.0k        |
| `Shelf` (host-rendered, shaken if unused) | 8.3k         |
| `default-paths`                           | 8.2k         |
| `PaneFrame`                               | 8.1k         |
| `Scroller`                                | 7.9k         |
| `HeaderActions`                           | 6.2k         |

**Reached by the minimal app but opt-in by nature:**

| Feature                          | Modules                                            | Size (bytes) |
| -------------------------------- | -------------------------------------------------- | ------------ |
| Settings, Chooser and ListDialog | `Settings` 4.7k, `Chooser` 4.1k, `ListDialog` 3.2k | ~12.0k       |
| Scroll rows                      | `Scroller`                                         | 7.9k         |
| Pop out                          | `PopOut`                                           | 4.3k         |
| Stacked phone view               | `Stacked`                                          | 3.5k         |
| Data-pressed                     | `pressed`                                          | 3.2k         |
| Rename                           | `RenameField`                                      | 2.7k         |

That is about 30k of roughly 130k pre-minify, or about 23%, which comes to about 5.5–6 KB gz.

**Fix:** make them modules passed in (target 4; the `DomPort` and `definePage` precedents). The palette is already `palette: false`, but its import is static, so it ships anyway.

**What is not credible without dropping features:** going much below 17 KB. The React side is a renderer for a large behaviour surface. The biggest lever on what an app ships is core (52 KB gz minimal, 13 KB min of it English messages), which dwarfs React's 24.5. The CSS ships unminified in `dist/` (`scripts/build-css.mjs`); minifying it is free.

### REACT-17 · P2 (tests) · Test gaps against what users hit · read · M

**What is good:** 84 unit files; render-count tests; React 18 and 19 hydration; hostile input; a public-API snapshot; axe in e2e.

**What is missing:**

- REACT-1 (state across single ⇄ tiled and strip moves).
- REACT-2.
- A boundary test for chrome (REACT-3).
- Two default workspaces under axe (REACT-4).
- An empty palette under axe (REACT-8).
- Buttons in a form (REACT-7).
- A `StrictMode` render. I checked by hand that reporting survives double effects, but nothing holds it.
- Pop out unmount and rejection (REACT-11).

The e2e suite runs Chromium only (`playwright.config.ts:30`), while the README promises Safari 17.5 and Firefox 120. Add WebKit and Firefox projects for `a11y`, `axe`, `keyboard`, `rtl` and `theme` at least: `light-dark()`, `:has()`, the inert property and `aria-description` support differ there.

### REACT-18 · P3 · Gap (a) residue: the label is a construction-time option only · read · S

**Evidence:** `createJali({ label })` (core `create-jali.ts:109-114`) does name the workspace and its inner landmarks (`a11y/landmark.ts`; `tests/landmarks.test.tsx` passes). But it can't be changed per render (a locale switch) or point at a visible heading (`aria-labelledby`, APG's preference).

**Fix:** `<JaliRoot aria-label | aria-labelledby>`, falling back to `env.label`. The within-names (`messages.workspace.within`) read the label string, so `aria-labelledby` needs the string as well (`label`), or reads the element's text once mounted.

### REACT-19 · P3 · State is duplicated as `is-*` classes beside the public attributes · read · M

**Evidence:**

- `PaneFrame.tsx:96-107` sets `is-focused`, `is-zoomed`, `is-dragged` and `is-drop-target` _and_ the matching `data-*`.
- `TabStrip.tsx:224` and `SwitcherItem.tsx:45` do the same.
- The CSS selects on the classes: 35 `is-*` uses in `pane.css`, for example `:16`, `:41`, `:157-161`.

The contract (`parts.ts:1-9`) says state is an attribute. Two sources of truth, and more bytes.

**Fix:** select on the public attributes in Jali's CSS and drop the `is-*` state classes. Specificity is moot inside `@layer jali`.

### REACT-20 · P3 · Jali writes the host's `data-theme` on `<html>`, its root and its layer · read · S–M

**Evidence:** core `state/settings.ts:84` and `JaliRoot.tsx:145-156`. This forces the exclusion selectors in `jali-theme.css:24-39` and `jali-tailwind.css:26-33`, and collides with daisyUI and next-themes conventions unless `pageTheme: false` is set.

**Fix:** write `data-jali-theme`. Read the host's `.dark`, `[data-theme]` and the system preference as today. Keep `pageTheme: "html"` as an explicit opt-in for apps that want Jali to drive the page.

### REACT-21 · P3 · Dead code and leftovers · read · S

- The `PaneHost` methods `setActivity`, `setUnsaved`, `setCommands`, `setTitle` and `setAttributes` (`pane/context.ts:15-19`, `PaneBody.tsx:25-29`, `peekHost` `:48-52`) have no caller since reporting merged into `report`.
- The unprefixed classes `palette-title` (`dialogs/Palette.tsx:42`, beside `jali-palette-name`) and `tab-more-n` (`TabOverflow.tsx:106`) break the "every class is `jali-`" decision. Trips already styles `.palette-title` (`examples/trips/src/styles/shell.css:319, 362`), so drop it now while pre-1.0.
- `setPopOutPort` and `isMac` are deprecated adapter exports to remove before 1.0.

### REACT-22 · P3 · Small a11y polish · read · S each

- The tuck button uses `disabled` (`HeaderActions.tsx:121`), so its reason (`cantTuck`) is unreachable by keyboard and screen readers. Use `aria-disabled` and ignore the click.
- Essential instructions live only in `aria-description` ("Delete closes it", folded or tucked state) in 10 places. That attribute is ARIA 1.3 and unevenly supported, so mirror the key hint in `aria-keyshortcuts`, which the tab already has, and keep state in the name or `aria-describedby`.
- `Menu` has no typeahead (APG recommends it for menus over about 7 items: the tab overflow lists every tab).
- The live region remounts when the layer moves into or out of a full-screen pane (`JaliRoot.tsx:92, 108-121`: the portal switch). A freshly inserted live region may not announce "Full screen" in some screen readers. Keep the `Announcer` outside the switched subtree. Not verified.
- The palette input is `outline: none` (`dialogs.css:35`).

### REACT-23 · P3 · Code-quality nits · read · S each

- `useTitle` and `usePaneAttributes` report in `useEffect` (`pane/hooks.ts:108-113, 132-135`), so the first paint shows the kind's title, then flips. A layout effect on the client avoids the flash and the tab re-measure.
- `PageTabs` re-adds three window listeners on every render (`PageBar.tsx:101-116`, an effect with no deps). Keep `ghost` in a ref and use deps `[store]`.
- The pop-out menu item is built twice, in `TabMenu.tsx:36-46` and `HeaderActions.tsx:85-87`, and outside the core's `tabMenuOf`, though `DomPort.popOut.can` now lets core list it.
- `useGeometry` subscribes to `resolved` but returns `store.model()` read outside the snapshot (`state/react.tsx:51-56`). That can tear under concurrent rendering: return the snapshot-consistent model.
- Host CSS that isn't layered (Bootstrap reboot, Tailwind v3 preflight, normalize) beats everything in `@layer jali`. The README says to declare the layer order, but not to import such sheets into a layer (`@import "bootstrap.css" layer(base)`). One paragraph.

## Known open gaps: the best fix for each

### (a) Several live workspaces repeat landmarks, and a host can't name them

Status: largely fixed on master. `createJali({ label })` names the workspace landmark and suffixes every inner landmark ("Order 7, Orders"). `tests/landmarks.test.tsx` passes, and with labels my axe run passed `landmark-unique`.

What is still wrong is REACT-4: duplicate DOM ids, verified, so the ARIA references cross workspaces. Behind it are silent defaults and a construction-only name (REACT-18).

Best fix, in order:

1. React scopes DOM ids per mounted root when `store.dom.id` collides (`useId`), with a dev error naming `id` and `label`.
2. A dev warning when two mounted roots have no `label`.
3. `<JaliRoot aria-label | aria-labelledby>` for render-time names and visible headings.
4. Optional, if landmark noise becomes a complaint: `landmarks: "workspace"`, where panes render `role="group"` with the same names. That keeps one landmark per workspace, which most APG reviewers prefer for 10-pane layouts. The brief currently mandates `region` per pane, so it should be an option, not a default.

With 1–3, the docs' best-practice scan needs no exclusion. The docs already run it on whole pages.

### (b) Pop out: keys don't work in the window, and state doesn't carry

What makes it stable:

1. **State carries: move the node, don't re-render it.**
   - Render `PaneBody` once, in one place, always (this also falls out of target 1).
   - On pop out, move the existing `.jali-pane-content-inner` element into the window's root (`win.document.body.append(inner)`), and move it back on Bring back or before close.
   - React's events need a listener on the new container. Mount an empty `createPortal(null, winRoot)` while popped out: React registers its root listeners on every portal container, and dispatch walks the fiber from the target node, so handlers keep working.
   - Component state, refs and subscriptions survive because nothing remounts.
   - Guard deletion: if the frame unmounts while popped, its section is removed from the main document. The moved node stays in the window, so close the window in the frame's cleanup.
   - Server rendering is unaffected, because the inline render path is unchanged.
2. **Keys.**
   - Core already takes a target: `installKeyboard(store, { target, root })` (`packages/core/src/commands/keyboard.ts:156-160`). On pop out, install a second keyboard on `win` with a scope whose `root()` returns the window root.
   - `mine()` (`:162-170`) must accept "inside the window root" as inside the workspace: add `DomPort.extraRoots()` or a `popOut.root()` the scope consults.
   - Workspace commands whose UI lives in the main document can't show in the window: ⌘K, Settings, the chooser, the discard question, and F6 or ⌥1–9 focus moves. So either (i) portal the layer's dialogs into whichever window holds focus (`JaliRoot`'s `inside()` already does this for full screen; generalise "the layer's host" to the focused window), or (ii) restrict the window's keymap to pane-scoped commands (close, bring back, the pane's own `useCommands`, undo). The window then announces "⌘K is in the main window".
   - I'd ship (ii) first; (i) is the same mechanism as full screen and can follow.
3. **Lifecycle.**
   - Close the window and clear `current` on `JaliRoot` unmount, `jali.destroy()` and store swap: subscribe in `StoreProvider`, not at module scope.
   - Catch `requestWindow` and resolve `false`, announcing why.
   - Key `current` by store so two workspaces can't fight over it.
4. **Look.**
   - Set `data-jali`, `dir` and the resolved theme on the window root.
   - Copy the inline `--jali-*` from `JaliRoot`'s computed style, or render a `[data-jali]` wrapper that gets the same `style` and `spacingVars`.
   - Re-copy on theme changes: subscribe to `useTheme` and a `MutationObserver` on `<html>`'s `class`, `data-*`, `dir` and `lang`, and on `head` for added stylesheets (Vite HMR and CSS-in-JS inject late).
   - Follow the pane's title for `document.title`.
5. **Tests.** Chromium e2e: state survives a round trip; ⌘W, the pane's own command and Bring back work by key inside the window; closing the root closes the window; theme toggle reaches the window. The jsdom fakes from this review cover lifecycle and rejection.
6. **Then drop `unstable_`.** Expose `popOut` through `allow.popOut` plus an opt-in import (`import { popOut } from "@jali/react/pop-out"`, passed as a module) so the 4.3k ships only to apps that turn it on.

## Notes on what is right (keep)

- One external store, with per-component selectors and `useEntriesOf` for per-pane slices. The render-count tests make the memoisation a contract, not a hope.
- The per-pane Suspense and error boundary, plus `Missing` and `Loading` as kind slots. The hydration hold for React 18 (`state/hydration.ts`) is careful and tested.
- Building the a11y primitives in-house (DECISIONS, 20 Nov) is defensible: they are small, cover the patterns used, and keep the bundle free of Radix. The gaps above are in their use (radiogroup, listbox empty state, tabpanel), not in the decision.
- The parts contract: Studio restyled to hardware with no `!important`, and the `light-dark()` tokens in `@layer jali`.
- `definePane` with typed params and callable refs: genuinely good first-30-minutes ergonomics.

## Counts

| Severity | Count                    |
| -------- | ------------------------ |
| P0       | 0                        |
| P1       | 5 (REACT-1 to REACT-5)   |
| P2       | 12 (REACT-6 to REACT-17) |
| P3       | 6 (REACT-18 to REACT-23) |
