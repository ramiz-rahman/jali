# Jali documentation review (Opus)

Repo: `/Users/ramizrahman/Projects/jali/.claude/worktrees/review-93526af` at `93526af`. Read-only. Checks I ran: `pnpm exec tsc --noEmit -p apps/docs` (passes), the docs reference tests `src/reference/{coverage,markdown}.test.ts` (14/14 pass), `pnpm --filter @jali/docs build` (34 pages, passes). I also took screenshots of 8 pages at 1440 and 390 px from `astro preview` on port 5461, then stopped the server.

## Verdict

- **The base is strong, and already above most libraries.** All 74 code samples are real files that get typechecked. A test makes every export, action, command, token and icon have a reference entry. Each page has Markdown, copy and "Open in Claude", plus `llms.txt`. The docs ship inside the package for coding agents, along with an agent skill. The diagrams are live workspaces, not pictures. The prose is plain and mostly free of AI tells.
- **It is not yet level with TanStack, Radix or react.dev**, for five reasons:
  1. A few facts are wrong. The main one is that `<JaliRoot>` and `<JaliProvider>` document a prop called `workspace`; the real prop is `jali`.
  2. Whole surfaces are undocumented: `@jali/core/agent`, SSR and Next.js, troubleshooting, building your own chrome.
  3. The UI words collide: "Single" means two different things, and so does "pin" versus "keep".
  4. A new user can't run anything without cloning the repo. There are no sandboxes and no hosted examples, and the Quickstart points at `fixtures/minimal`.
  5. The contributor docs are an internal log, not onboarding. `BRIEF.md` calls Jali "a throwaway spike" of the Sixface pane system and lists absolute paths on Ramiz's Mac. There is no CONTRIBUTING, ARCHITECTURE, LICENSE or CHANGELOG.
- **Fix the 4 P0s and the P1s, and the docs are ready to publish.** The P2s are what take them from very good to best in class.

Counts: **P0 4 · P1 13 · P2 15 · P3 8** (40 findings).

---

## Reference coverage

**How this was measured:**
- **Reference entry:** whether the name has an `<Entry>` or `<Member>` in `apps/docs/src/docs/reference/**`. The coverage test enforces this for `@jali/core`, `layout.*`, `@jali/react` and `@jali/react/icons`, so every name there has one.
- **Guide / Learn use:** whether a Get started, Learn or Guides page or sample uses the name. I computed this with a script over the MDX and samples. "Example use" means one of the five apps in `examples/` uses it.

### `@jali/core` (`.`)

| Area | Exports | Reference entry | Guide / Learn use | Gaps |
|---|---|---|---|---|
| Start here | `createJali`, `row`, `column`, `tabs`, `pane`, `toLayout`; types `Jali`, `JaliOptions`, `PresetOptions`, `LayoutInput`, `SizeOptions`, `RowOptions`, `PaneNodeOptions`, `TabsOptions` | all | all but `toLayout` | `row`/`column`/`tabs` return `Draft`, `SplitDraft` and `PaneDraft`, which are **not exported** (DOCS-25) |
| Pane kinds | `optional`, `oneOf`, `appOnly`, `definePage`; types `PaneOptions`, `PaneWidth`, `PaneHeight`, `PaneDefinition`, `PaneKindBase`, `PaneKinds`, `PaneCommand`, `PaneActivity`, `PaneErrorInfo`, `Params`, `ParamValue`, `ParamType`, `ParamTypes`, `ParamsOf`, `OptionalParam`, `ParamOptions`, `AppOnlyParam`, `OneOf`, `ParamProblem`, `FollowParams` | all | `optional`, `oneOf`, `ParamsOf`; **`appOnly` is in no guide** (the Params table at pane-kinds.mdx:87-94 leaves it out) | add `appOnly` and `optional(…, { link: false })` rows to the Params table |
| Profile / page | types `RoleBase`, `ProfileBase`, `ViewMode`, `Preset`, `Env`, `ItemId`, `PhoneOptions` | all | prose only | `ItemId` is contradicted in curated-pages.mdx:30 (DOCS-3) |
| Layout tree types | `Axis`, `Direction`, `Edge`, `Size`, `NodeId`, `ObjectRef`, `Layout`, `LayoutNode`, `PaneNode`, `SplitNode`, `StackNode`, `Overlay`, `ViewState`, `Rect`, `ResolvedLayout`, `ResolvedStack`, `PaneBox`, `DividerBox`, `ScrollerBox`, `PaneKind`, `KindRegistry`, `LayoutContext`, `FitOptions`, `ShelfEntry` | all | the Layout tree page explains the shape | fine |
| `layout` namespace (about 50 pure ops: `open`, `tuck`, `resolve`, `refit`, `encode` …) and `layout.tree.*` | | all (test-enforced) | none in guides; the reference page has a sample | a "Work with layouts in code" guide would help (DOCS-34) |
| Instance and actions | `sameRef`; types `JaliEventBase`, `JaliEvents`, `JaliState`, `JaliInput`, `JaliActions` (all about 40 `actions.*` have entries), `ActionName`, `PaneTarget`, `OpenPageOptions`, `OpenBesideOptions`, `ChooseOptions`, `ActionResult`, `Refusal`, `RefusalReason`, `BeforeClose`, `CloseRequest`, `Toast`, `HistoryMode` | all | actions used widely; `sameRef` in no guide | — |
| Allow and buttons | `AllowContext`, `AllowRule`, `PaneAllow`, `PaneControl`, `WorkspaceAllow`, `PaneButton`, `PaneButtons`, `ButtonsContext` | all | pane-controls guide | — |
| State | `PageState`, `Selection`, `UrlState`, `UrlWriter`, `JaliModel`, `Group`, `Settings`, `ThemeChoice`, `Theme` | all | partial | `createJali({ url })` is documented as `boolean \| UrlSyncOptions` but also takes `UrlWriter` (create-jali.ts:71 vs core.mdx:48) |
| Words | `en`, `Messages`, `MessageOverrides`, `ScreenDirection` | all | translating guide | — |
| Address and storage | `linkSearch`, `browserLocation`, `memoryLocation`, `browserStorage`, `memoryStorage`; types `UrlSyncOptions`, `LinkSizes`, `JaliLink`, `PageLink`, `LayoutLink`, `LinkSearchOptions`, `LocationPort`, `StoragePort`, `NavigateMode` | all | url guide, testing guide; `browserLocation`/`browserStorage` in no guide | — |
| Commands and keys | `commandsOf`, `runCommand`, `copyLink`, `listCommands`, `DEFAULT_KEYMAP`, `keyHint`, `formatKeys`, `altClick`; types `Command`, `ListedCommand`, `TabMenu`, `TabMenuItem`, `Rename`, `Keymap`, `KeymapOverrides`, `KeymapOptions`, `DefaultKeymapId`, `KeyString`, `Platform`, `KeyWords`, `Chord`, `KeySequence` | all | commands guide; `commandsOf`, `copyLink`, `DEFAULT_KEYMAP`, `altClick` reference-only | — |
| Geometry | `GAP`, `edgeScroll`, `EdgeScroll` | all | `edgeScroll` in scrolling-rows | — |
| Contracts | `activeItemPort`, `ActiveItemMapping`, `ActiveItemPort`, `ActiveItemAction`, `ActiveItemWriteResult` | all | Chakni guide | — |

### `@jali/core/agent` (separate entry point)

| Exports | Reference entry | Guide use |
|---|---|---|
| `createAgent`, `AGENT_ACTIONS`; types `AgentAction`, `AgentStep`, `AgentOptions`, `AgentPaneState`, `AgentPane`, `AgentKind`, `AgentSnapshot`, `AgentStepResult`, `AgentResult`, `AgentTool`, `JaliAgent`, `ModelContextLike` (agent.ts:25-197) | **none.** The coverage test imports only `@jali/core`, `@jali/react` and `/icons` (coverage.test.ts:11-13) | guides/agents.mdx (prose only) |

### `@jali/core/adapter`

Meant for framework adapters, and documented as changeable in any minor version (adapter.ts:3). But **the testing and unsaved-work guides tell app authors to use `storeOf`** from it (testing.mdx:32, unsaved-work-and-pane-state.mdx:111). See DOCS-9.

### `@jali/react` and subpaths

| Area | Exports | Reference entry | Guide / Learn use | Gaps |
|---|---|---|---|---|
| Start here | `JaliRoot`, `JaliProvider`, `JaliView`, `JaliRootProps` | all | `JaliRoot`, `JaliView` yes; **`JaliProvider` in no guide** | **wrong prop name `workspace`** on both (DOCS-1) |
| Defining | `definePane`, `definePage`, `Pane`, `PaneProps`, `PaneOptionsReact`, `MissingProps`, `Page`, `PageView`, `optional`, `oneOf`, `appOnly` | all | yes | `Pane` signature uses unexported `PaneKindDef` (react.mdx:83) |
| Inside a pane | `usePane`, `useActivity`, `useUnsaved`, `useCommands`, `useTitle`, `usePaneAttributes`, `useHeaderActions`, `useLauncher`, `LauncherSources`, `usePaneState`, `PaneStateOptions`, `useActiveItemPort` | all | yes (`useLauncher` only briefly) | — |
| Workspace hooks | `useJali`, `useJaliState`, `useJaliModel`, `useTheme`, `useShortcut`, `useJaliCommands`, `keyBelongsToContent` | all | `useJaliModel` in no guide | — |
| Parts | `Panes`, `CuratedPage`, `PageBar`, `Shelf`, `Announcer`, `Palette`, `SettingsPanel`, `Chooser`, `ConfirmDiscard`, `KindIcon`, `Activity`, `IconButton`, `IconButtonProps` | all | **in no guide except `PageBar`/`Shelf` mentions**, yet every example builds its own chrome | DOCS-17 |
| Icons | `useJaliIcons`, `JaliIcon`, `JaliIconName`, `JaliIconProps`, `JaliIcons`; `@jali/react/icons` `defaultIcons` and every `icons.*` name | all | theming guide | — |
| Experimental | `unstable_popOut`, `unstable_bringBack`, `unstable_canPopOut` | all | **no guide**; no stability policy page | DOCS-33 |
| CSS entry points | `styles.css`, `theme.css`, `tailwind.css` | react.mdx:23, tokens | theming | — |

**What this means:** name coverage is complete and enforced, which is rare and excellent. The gaps are of three kinds:
1. One entry point with no reference (`/agent`).
2. Props and option names are not checked against the types, which is how DOCS-1 got through.
3. Reference-only surfaces with no task guide: chrome composition, pop-out, the `layout` namespace, and `appOnly`.

---

## Proposed information architecture

The shape follows react.dev (Learn vs Reference), TanStack (framework adapters, guides, API, examples with sandboxes) and Radix (Overview, Guides, one page per part with an accessibility section). It keeps Jali's own Get started / Learn / Guides / Reference split.

```
Home                      one line, live hero (keep the tour), 10-line example, 3 ways in
Get started
  Introduction            problem, what you get, when not to use it  (keep)
  Why Jali                NEW: vs react-resizable-panels, allotment, dockview, FlexLayout, Golden Layout,
                          react-mosaic; one table: tiling / folding / URL / follow / a11y / bundle
  Installation            NEW: npm/pnpm/yarn/bun, React 18.2+, browsers, CSS layer line, Vite · Next.js ·
                          Remix/React Router · Astro tabs; monorepo/linking moved here from Quickstart
  Quickstart              npm create vite → 3 files → running; "Open in StackBlitz"; ends at a working app
  Key concepts            glossary, plus a UI-word ↔ API-name table (Single view, Split view, fold, tuck,
                          shelf, peek, Following/Kept, Opened, Back to …)
  Using Jali with coding agents   (keep) + the skill + llms.txt / llms-full.txt / MCP
Learn
  The layout tree         (keep)
  How a layout fits       widths, sharing room, fold order (interactive), unfolding, pane cap
  Small screens           NEW, split out of fitting: Single view on phones, stacking two, folding screens,
                          maximise and full screen
  Opening and linking     (keep)
  Following a list        (keep; "Keep", never "pin")
  Curated pages           (keep) + a live figure
  Accessibility           NEW: landmarks, F6, APG separators, announcements, inert dialogs, WCAG 2.5.7, what
                          the app must still do
Guides
  Build
    Define a pane kind · Start from presets · Keep the layout in the URL (+ routers)
    Build your app's chrome          NEW: JaliProvider/JaliView, top bar, status line, Shelf, toasts (Sonner),
                                     PageBar, IconButton, useShortcut
    Load data in panes               NEW: TanStack Query / SWR, keyed cache, paused, Suspense + Loading/Missing
    Save layouts per user            NEW (from presets guide): server-side saving, `saved`, events
  Interaction
    Unsaved work and pane state · Tabs · Rows that scroll sideways · Choose what people can do ·
    Commands and keys · Auto layout · Pop out (experimental)
  Look and language
    Theming (+ recipes: shadcn/ui, Radix Themes, dark-first, compact) · Translate Jali
  Integrations
    Server rendering and Next.js     NEW
    Use Jali with Chakni · Let an agent use the workspace · Two workspaces on one page
  Quality
    Test a workspace (public test helpers) · Troubleshooting (NEW) · FAQ (NEW)
Reference
  @jali/core · @jali/core types · The layout namespace · @jali/core/agent (NEW)
  @jali/react · Parts (CSS) · Tokens · Commands · Icons (own page)
Examples                  one card per app: screenshot, hosted demo, "Open in StackBlitz", source link, what it shows
Releases                  NEW: changelog, versioning and stability (unstable_*, adapter entry), upgrade notes
Contributing (repo)       CONTRIBUTING.md, ARCHITECTURE.md, docs/AGENTS.md; history moved to docs/history/
```

**Site-wide:**
- Use Pagefind full-text search, as the plan says.
- Add `llms-full.txt`.
- Show a "Copy for LLM" on each reference entry.
- Point the Edit link at the right branch.
- Add Report an issue.
- Keep the reference measure at 75ch or less, with Stripe's two columns (prose left, sticky signature and example right) as DOCS-PLAN.md specifies.

---

## Findings (ranked)

### P0: wrong or misleading

**DOCS-1 · P0 · `<JaliRoot>` and `<JaliProvider>` document a prop named `workspace`; the real prop is `jali`.**
- **Evidence:** apps/docs/src/docs/reference/react.mdx:38 `<Param name="workspace" type="Jali" required>` and :332 the same for JaliProvider. The real props are `jali: Jali` (packages/react/src/JaliRoot.tsx:47; JaliProvider at :159-161). The page contradicts itself: the signatures on :27 and :327 say `jali={jali}`. The same text is shipped to agents in packages/core/docs/reference/react.md ("**`workspace`** (`Jali`, required)"). An agent that trusts the props table writes code that won't compile.
- **Fix:** rename both Params to `jali`.
- **Root cause:** the coverage test checks names only. Add a test that, for each component and options entry, compares the `<Param name>` set with the real props or options type. Use the TS checker on `JaliRootProps`, `JaliOptions`, `PaneOptionsReact`, `PaneProps` and `UrlSyncOptions`. Fail on any name in one set and not the other.
- **Effort:** S (fix) + M (test).

**DOCS-2 · P0 · The home page lists `Jali` as an `@jali/react` export. There is no such export.**
- **Evidence:** apps/docs/src/docs/index.mdx:41 `exports="Jali, definePane, usePane, …"`. It is visible in the "Two packages" section of the home screenshot. The real component is `JaliRoot` (packages/react/src/index.ts:7).
- **Fix:** change `Jali` to `JaliRoot`. Also make the `<Package exports>` chips link to the reference entries, and check them in the coverage test.
- **Effort:** S.

**DOCS-3 · P0 · The Curated pages page says "Items are numbers". Item ids can be strings.**
- **Evidence:** apps/docs/src/docs/learn/curated-pages.mdx:30 "Items are numbers: `item` is the id a link carries." But the core has `export type ItemId = string | number` ("a UUID, a slug", packages/core/src/profile.ts:31-33), and the reference says "`I` is the item id's type, `number` or `string`" (react.mdx:139).
- **Fix:** "An item is a number or a string (a UUID, a slug). A link carries it as text; if `firstItem` is a number, you get numbers back."
- **Effort:** S.

**DOCS-4 · P0 · The testing guide says it uses Vitest, but its sample imports from `vite-plus/test`.**
- **Evidence:** guides/testing.mdx:8 "This guide uses Vitest with jsdom". samples/guides/testing/workspace.test.ts:1 `import { … } from "vite-plus/test"`. A reader who copies it gets a missing-module error. `vite-plus` is the repo's own toolchain, not the reader's.
- **Fix:** import from `vitest` in the sample. The repo's own tests can alias it.
- **Effort:** S.

### P1: missing something important

**DOCS-5 · P1 · "Single" means two different things, and the docs use four spellings for them.**
- **Evidence:**
  - Phone fallback: "Single view" (key-concepts.mdx:72; fitting.mdx:100-102, written lowercase as "a single view"; UI string `singleOn: "Single view: one pane at a time"`, packages/core/src/state/messages.ts:157).
  - Curated-page mode: "Single" (key-concepts.mdx:120; messages.ts:152), "Single mode" (opening-and-linking.mdx:71, curated-pages.mdx:26, examples/index.mdx:37) and "Single view" (opening-and-linking.mdx:29, react.mdx:191, agent.ts:59 `setMode … Single view or Split view`).
  - A reader can't tell whether "In Single view a link still peeks" (opening-and-linking.mdx:29) is about phones or pages.
- **Fix:** pick distinct UI words, for example **Single view** for the page mode and **Phone view** (or "One at a time") for the narrow fallback. Raise it with the packages, because the collision is in `messages.ts`. In the docs, add a Key concepts table of UI word ↔ API name, and never write "Single mode".
- **Effort:** M.

**DOCS-6 · P1 · The Following page says "pin" for what Jali calls "Keep", against its own rule.**
- **Evidence:** learn/following.mdx:3 summary "…follows that selection, in place, until the person pins it." This summary also goes to llms.txt, the meta description and packages/core/docs. The heading `## Pinning` (:59) is followed by "'Keep' is what other tools call pinning a follower; in Jali, 'pin' is for tabs" (:61). key-concepts.mdx:106 states the same rule.
- **Fix:** summary "…until the person keeps it"; heading "Keeping a detail". Keep the one-line note for people coming from other tools.
- **Effort:** S.

**DOCS-7 · P1 · `@jali/core/agent` has no reference at all.**
- **Evidence:** packages/core/src/agent.ts exports `createAgent`, `AGENT_ACTIONS`, `AgentOptions`, `JaliAgent`, `AgentSnapshot`, `AgentStep`, `AgentResult`, `AgentTool` and more (lines 25-197). The reference has no entry for any of them. coverage.test.ts:11-13 imports only `.`, `react` and `react/icons`. guides/agents.mdx describes the options (`actions`, `allow`, `arrange`) in prose, with no types or defaults.
- **Fix:** add a "@jali/core/agent" reference page and extend the coverage test to every `exports` subpath in both package.json files.
- **Effort:** M.

**DOCS-8 · P1 · There is no installation or framework page, and nothing on SSR or Next.js.**
- **Evidence:**
  - `@jali/react` has no `"use client"` directive. `createJali` checks `typeof window` (packages/core/src/create-jali.ts:189).
  - `createJali({ size })` mentions "server rendering" (core.mdx:75), and `useShortcut` is "safe to prerender" (react.mdx:317). These hints are all there is.
  - No page says how to use Jali in the Next.js App Router, Remix or React Router framework mode, or Astro, or what renders on the server. `_lab.mdx:60` has an unpublished "Next.js" tab.
- **Fix:** add an Installation page with framework tabs, and a "Server rendering" guide: where to call `createJali`, client boundary, `size`, hydration of the address, and storage on the server. Consider shipping `"use client"` in the React entry.
- **Effort:** M.

**DOCS-9 · P1 · The guides tell app authors to use an internal API to test unsaved work.**
- **Evidence:** testing.mdx:32 and unsaved-work-and-pane-state.mdx:111 use `storeOf(jali).actions.setUnsaved(...)` from `@jali/core/adapter`. That entry point says "Names here that are not in "@jali/core" can change in any minor version" (packages/core/src/adapter.ts:3). The sample does the same (samples/guides/testing/workspace.test.ts:3, :40).
- **Fix:** add a public test helper, for example `@jali/core/testing` with `createTestJali({ size, search })` and `reportUnsaved(jali, pane, text)`. Or make `setUnsaved` a documented action. Then rewrite the guide around it. Also add a "Test a pane component" section: rendering one kind with React Testing Library inside a `JaliProvider`.
- **Effort:** M.

**DOCS-10 · P1 · The Quickstart can't be run from zero without the repo.**
- **Evidence:**
  - quickstart.mdx:13 "This page builds the app in `fixtures/minimal`", a repo path an npm user doesn't have. The shipped Markdown repeats it, and so does packages/react/README.md:61 "See `fixtures/minimal`".
  - :15 "You need a React app" gives no command to make one.
  - There is no sandbox link.
  - Step 1 opens with a two-paragraph warning about `link:` setups, `vp pack` and Vitest `ssr.resolve.conditions` (:28-32). That is noise for the 95% who install from npm.
- **Fix:**
  - Step 0: `npm create vite@latest my-app -- --template react-ts`.
  - Link `fixtures/minimal` on GitHub and add "Open in StackBlitz".
  - Move the monorepo callout to Installation or Troubleshooting, and leave one line plus a link in its place.
- **Effort:** S–M.

**DOCS-11 · P1 · There is no Troubleshooting page and no FAQ. The fixes are spread across other pages.**
- **Evidence:**
  - Two copies of React / "Invalid hook call": quickstart.mdx:29 and react README:13.
  - Zero-height workspace: quickstart.mdx:66.
  - Layer order wrong: theming.mdx:32-34.
  - Keys not reaching Jali after `stopPropagation`: coding-agents.mdx:34.
  - jsdom 0×0 folding every pane: testing.mdx:62.
  - A linked `dist` not rebuilding: quickstart.mdx:31.
- **Fix:** a Troubleshooting page with one heading per symptom, quoting the exact console message or what the reader sees, then cause and fix. An FAQ covering bundle size, SSR, floating windows, Vue/Svelte, licence, React Native, and saving to a server.
- **Effort:** M.

**DOCS-12 · P1 · There is no "Why Jali" or comparison page.**
- **Evidence:** introduction.mdx:53-57 "When not to use it" is a good start. Nothing names the alternatives a reader is weighing: react-resizable-panels, allotment, dockview, FlexLayout, Golden Layout, react-mosaic. TanStack and Radix both answer "why this one" early.
- **Fix:** one honest table covering tiling vs floating, fold vs squeeze, URL round-trip, follow/selection, keyboard and accessibility, curated pages, bundle size, framework-free core. Add a paragraph on where each alternative is the better choice.
- **Effort:** M.

**DOCS-13 · P1 · The examples need the repo cloned and `vp` installed: no hosted demos, no screenshots, no sandboxes.**
- **Evidence:** examples/index.mdx:6 "Run `vp install` at the repository's root…". Each example only links to `localhost:53xx`. Studio already builds as a static site (examples/studio/README.md:10), so hosting is possible.
- **Fix:** deploy each example (for example `jali.ramizrahman.com/examples/markets/`). Give each a screenshot card, a "Try it" link, a source link and the "What to try" list from its README.
- **Effort:** M.

**DOCS-14 · P1 · The root README is not a front door.**
- **Evidence:**
  - README.md:1-8 is a tagline followed by `vp install` / `vp dev`. There is no link to the docs site, no install line, no code, no picture.
  - :24-30 is instructions for coding-agent sessions ("**Every session runs `pnpm verify` before it commits**, and says in its report which gates fail").
  - `vp` (Vite+) appears without explanation, while everything else says `pnpm`.
- **Fix:** README order: tagline → GIF or screenshot of the fold → docs link → `npm install` → 12-line example → the five examples with hosted links → licence → "Contributing: see CONTRIBUTING.md". Move the gates and ports to CONTRIBUTING.md, and the agent rules to AGENTS.md.
- **Effort:** S.

**DOCS-15 · P1 · The contributor docs are an internal log, with private paths and Sixface framing. CONTRIBUTING, ARCHITECTURE and LICENSE are missing.**
- **Evidence:**
  - docs/BRIEF.md:3 "a throwaway spike that proves the shared Sixface pane system". :7-9 give absolute paths under `/Users/ramizrahman/Projects/Sixface-Initiate/…`. :26-30 still describe react-resizable-panels and Ark adapters that are gone.
  - docs/DECISIONS.md is 1,341 append-only lines that open with dead names (`registerPaneKind`, `layout-core`, `PaneComponentProps`). It is valuable history but useless for onboarding.
  - Sixface also appears in FINDINGS.md and research/docs-sites.md. This goes against the brand rule that Jali has its own identity.
  - There is no root LICENSE, but packages/*/package.json:5 say `Apache-2.0`. The site footer says "Licence to come." (apps/docs/src/shell/landing/SiteFooter.tsx:96) and links to a missing `/blob/main/LICENSE` (:45).
  - No CONTRIBUTING.md, ARCHITECTURE.md, CHANGELOG.md or SECURITY.md. ARCHITECTURE-REVIEW.md is a review, not a guide.
- **Fix:**
  - Write ARCHITECTURE.md (2 pages): the packages and the adapter boundary; layout tree → overlay → fit/resolve; store → actions → apply → events; ports; DOM port; the React adapter; the docs pipeline (MDX → static, samples typechecked, agent-docs).
  - Write CONTRIBUTING.md: setup, `pnpm verify` gates, ports, coverage rules, commit style, how to add an export (entry plus sample).
  - Decide the licence and add LICENSE.
  - Move BRIEF, DECISIONS, FINDINGS and QUALITY-REVIEW into `docs/history/`, removing private paths and Sixface.
- **Effort:** L.

**DOCS-16 · P1 · There is no guide for building your app's own chrome. Every real app needs one.**
- **Evidence:**
  - The script found `JaliProvider`, `Panes`, `Announcer`, `Palette`, `SettingsPanel`, `Chooser`, `ConfirmDiscard`, `KindIcon`, `Activity`, `IconButton` and `useJaliModel` in no guide.
  - react.mdx:35 says the shelf and toasts are "yours to render". Without a shelf, tucked panes only come back through ⌘K.
  - All five examples build a top bar, a status line and toasts.
- **Fix:** guide "Build your app's chrome": `<JaliRoot>` with children, a top bar with presets and `useShortcut` tooltips, a status line with `<Shelf/>` and `useJaliState`, toasts from `jali.onToast` with Sonner in `overlays`, `PageBar` for curated pages, and when to use `JaliProvider` alone.
- **Effort:** M.

**DOCS-17 · P1 · The props-and-options tables are not checked against the types.**
- **Evidence:** DOCS-1 got through a test suite that checks entry names only (coverage.test.ts:28-37). Other small drifts of the same kind:
  - `url` lacks `UrlWriter` (core.mdx:48 vs create-jali.ts:71).
  - `panes` lacks `PaneKinds<D>` (core.mdx:41 vs create-jali.ts:53).
- **Fix:** the type-driven Param test in DOCS-1. Generate the type column from the checker, so it can't drift.
- **Effort:** M.

### P2: before 1.0

**DOCS-18 · P2 · Reference pages are too wide to read comfortably, and each entry is dense.**
- **Evidence:**
  - At 1440 px the reference drops the right TOC and widens the article to 66rem (apps/docs/src/styles/layout.css:193-201). Lines run to about 150 characters (screenshot of /reference/react).
  - DOCS-PLAN.md:36 promised Stripe-style two columns and a 70-character page.
  - Entries pack every edge case into one paragraph: `optional`'s `link: false` is about 120 words (core.mdx:113), `appOnly` about 150 (core.mdx:122), `useTitle` four paragraphs (react.mdx:183-191).
- **Fix:** two columns (prose and options left; sticky signature and example right) or a 75ch measure. Each entry gets one line of what it does, an example, the options, then a collapsed "Details" for edge cases.
- **Effort:** L.

**DOCS-19 · P2 · Search covers titles, summaries, headings and entry names only, not body text.**
- **Evidence:** apps/docs/src/client/search.tsx:1-4 ("A stand-in until Pagefind…"). Searching "Invalid hook call", "dedupe" or "container queries" finds nothing.
- **Fix:** Pagefind over `dist/`, keeping entry-name boosting.
- **Effort:** M.

**DOCS-20 · P2 · No `llms-full.txt`; only "Open in Claude".**
- **Evidence:** dist has only `llms.txt`; DOCS-PLAN.md:47 planned `llms-full.txt`. Page actions are in apps/docs/src/shell/Page.tsx:14-42.
- **Fix:** emit `llms-full.txt`. Add "Copy for LLM" on each reference entry. Consider ChatGPT and Cursor links, or an MCP docs server. The package already ships the Markdown, which is the bigger win.
- **Effort:** S.

**DOCS-21 · P2 · The landing hero uses jargon, and the tagline changes from place to place.**
- **Evidence:**
  - index.mdx:9 "Multiplex any part of your app into panes". "Multiplex" is an internal word.
  - Taglines in use: "Panes that fit the screen…" (README.md:3), "Split views for your React app" (index.mdx:9), "Split any part of your app into panes…" (index.mdx:3), "A workspace of panes that fits the space it has" (core README:3), "Workspaces of panes for React" (SiteFooter.tsx:65).
- **Fix:** one line everywhere, for example "Split views for React: panes fold into tabs instead of squeezing, follow each other, and come back from a link exactly as they were." Replace "Multiplex" with "Split".
- **Effort:** S.

**DOCS-22 · P2 · The curated-page words sprawl.**
- **Evidence:**
  - The concept has four names: "curated page", "page", "profile" and `definePage`/`Page`/`ProfileBase` (key-concepts.mdx:110-114).
  - "role" in code is "view" in the UI ("A role is one view…", :116-118).
  - "investigation" (:124-126; curated-pages.mdx:84-92) appears nowhere in the UI, which says "Opened" and "Back to …". The API calls it `setCanInvestigate` (curated-pages.mdx:103).
  - `viewers` are "full" and "limited" (:101).
- **Fix:**
  - Use "curated page" in prose and "page" in code; drop "profile" from visible copy.
  - Say "view" in prose and note once that the API calls it a role.
  - Replace "investigation" with "opened panes" in prose. Consider renaming `setCanInvestigate` before 1.0.
- **Effort:** M.

**DOCS-23 · P2 · "How a layout fits" holds too much.**
- **Evidence:** fitting.mdx:86-114 covers the pane cap, the quiet single pane, maximise, full screen, phones, stacking two panes on phones, and folding screens. :62 is a 55-word sentence, and :106 is a run-on paragraph with five rules.
- **Fix:** move phones, stacking, folding screens, maximise and full screen to a "Small screens" Learn page. Break :62 and :106 into lists.
- **Effort:** M.

**DOCS-24 · P2 · The most complex ideas have no figure; one figure adds little.**
- **Evidence:**
  - curated-pages.mdx imports no live part. Single vs Split, ⌥-click placement and "Back to" are the hardest ideas in the docs.
  - "What folds first" (fitting.mdx:37-54) is a 6-step list plus 5 tie-breakers that a figure would make obvious.
  - layout-tree.mdx:39 spotlights "The tab strip of a stack", which the TreeView above it already shows.
- **Fix:**
  - A live curated page (the Loan review page, small) with a Single/Split toggle.
  - A fold-order figure: a fixed layout, a "narrow by one step" button, each pane labelled with its priority and reason ("protected", "far end of chain").
  - Drop or repurpose the tab-strip spotlight.
- **Effort:** M–L.

**DOCS-25 · P2 · Some signatures name types you can't import.**
- **Evidence:**
  - `row(...): Draft`, `tabs(...)`, `pane(...): PaneDraft` (core.mdx:146-197). `Draft`, `SplitDraft`, `TabsDraft` and `PaneDraft` are exported from layout/build.ts:41-48 but not from packages/core/src/index.ts:9-20.
  - `Pane` is typed with `PaneKindDef` (react.mdx:83), which is not exported either.
- **Fix:** export them as types, or show the signatures in terms of `LayoutInput`.
- **Effort:** S.

**DOCS-26 · P2 · There is no Accessibility page.**
- **Evidence:** Jali does a lot for accessibility, but the facts are scattered:
  - region/main landmarks: quickstart.mdx:68, core.mdx:70-71
  - the WAI-ARIA separator pattern: BRIEF.md:30
  - announcements: opening-and-linking.mdx:81-87
  - modal dialogs with `inert`: react.mdx:33
  - Add to tabs of… for WCAG 2.5.7: DECISIONS.md
  - labels for two workspaces: core.mdx:71

  This is a selling point that Radix gives its own section on every page.
- **Fix:** a Learn page on what Jali guarantees and what your panes must do (names, focus inside panes, key claiming).
- **Effort:** M.

**DOCS-27 · P2 · No releases, changelog or stability policy.**
- **Evidence:**
  - Both packages are `0.0.0` (packages/*/package.json:3), and the shipped docs say "version (0.0.0)".
  - `unstable_*` is explained only in a code comment (packages/react/src/index.ts:9-11).
  - The adapter entry's "can change in any minor" is only in adapter.ts:3.
- **Fix:** a Releases page covering semver policy, what `unstable_` means, the adapter entry, and a CHANGELOG generated from releases. Add upgrade notes from 1.0 on.
- **Effort:** S–M.

**DOCS-28 · P2 · "Edit this page" points to the wrong branch.**
- **Evidence:** apps/docs/src/site/config.ts:6 builds `…/edit/main/…`, but the repo's branch is `master`. REPO_URL is a placeholder (:1-3). There is also no "Report an issue" (DOCS-PLAN.md:38).
- **Fix:** make the branch configurable, add Report an issue, and check both links in e2e once the repo is public.
- **Effort:** S.

**DOCS-29 · P2 · The examples and contributor paths say `vp`; the rest of the docs say `pnpm`.**
- **Evidence:** README.md:6-7, examples/index.mdx:6, every examples/*/README "vp install / vp dev". The quickstart callout says "run `vp pack`" (quickstart.mdx:31). The install tabs offer "vp" next to npm, pnpm, yarn and bun (home screenshot).
- **Fix:** give `pnpm` commands, or say once what Vite+ (`vp`) is and how to get it. Drop "vp" from the reader-facing install tabs.
- **Effort:** S.

**DOCS-30 · P2 · Common recipes are missing.**
- **Evidence:**
  - Data fetching: one paragraph (coding-agents.mdx:70-74).
  - Saving layouts per user: partly in presets.mdx:60-90.
  - Pop out: reference only.
  - Theming recipes for shadcn/ui, Radix Themes or a compact density: only a teal accent (theming.mdx:66-70).
  - Using the pure `layout.*` operations in code: none.
- **Fix:** add "Load data in panes" (TanStack Query, `paused`, Suspense with `Loading` and `Missing`), "Save layouts per user", "Pop out (experimental)", three theming recipes with screenshots, and "Work with layouts in code".
- **Effort:** M.

**DOCS-31 · P2 · A cross-reference goes to the wrong page.**
- **Evidence:** reference/core/types.mdx:177 `<Ref to="layout.scrolled">` with page `/reference/core/types`, but the entry is on `/reference/core/layout`. A script checked all `<Ref>` targets, and this is the only mismatch.
- **Fix:** add `page="/reference/core/layout"`. Make `<Ref>` resolve its page from an entry index at build time, so this can't recur.
- **Effort:** S.

**DOCS-32 · P2 · DOCS-PLAN.md is out of date.**
- **Evidence:** DOCS-PLAN.md:23-29 lists `createUiStore`, `createPaneKinds`, `createUrlSync`, `boot / startUi`, `<Jali>`, `definePaneKind` and `PaneComponentProps`, all gone. It also promises Pagefind, two-column reference, identifiers linking to the reference, a package switcher and Report an issue, none of which exist. apps/docs/AGENTS.md tells agents to read it first.
- **Fix:** update it to the current API and mark each item done or pending.
- **Effort:** S.

### P3: polish

**DOCS-33 · P3 · A count is wrong.** pane-kinds.mdx:76 says "Two more options:", then lists four (`holdWhileResizing`, `inRecent`, `follow`, `selects`). Change it to "Four more options", or split it. Effort S.

**DOCS-34 · P3 · The old word "store" shows in anchors and prose.**
- **Evidence:** the "Workspace and actions" heading has the id `store` (key-concepts.mdx:134), and quickstart.mdx:51 links `#store`. testing.mdx:66 says "Store tests". Internally `useStore`/`createUiStore` remain.
- **Fix:** id `workspace`, keeping `store` as an alias anchor; "Workspace tests".
- **Effort:** S.

**DOCS-35 · P3 · The `Activity` component's prop is named `a`.**
- **Evidence:** packages/react/src/pane/Activity.tsx:32 `{ a, shape }`; documented as `<Activity a={activity} />`.
- **Fix:** report it to the packages and rename it to `activity` before 1.0.
- **Effort:** S.

**DOCS-36 · P3 · The theming guide has a misplaced paragraph and an overlong one.**
- **Evidence:** theming.mdx:64 (accent tints) sits under "## Spacing". :83 is a 120-word paragraph mixing `data-theme` mirroring, images and `pageTheme: false`.
- **Fix:** move :64 under tokens; split :83 into "Jali's theme setting" and "If your app has its own switch".
- **Effort:** S.

**DOCS-37 · P3 · The coding-agents page copies the theming guide, which risks drift.** coding-agents.mdx:80-97 ("Retheming") repeats the theming guide. Keep rule 10 and link the guide. Effort S.

**DOCS-38 · P3 · The Spotlight figures' labels don't come from the product's message strings.** The labels in apps/docs/src/live/Spotlight.tsx:19-36 ("Folded: the panes there wasn't room for…") are written separately from `messages.ts` (`foldedChipTip`). Where a label quotes the UI, read it from `en`. Effort S.

**DOCS-39 · P3 · The shipped Markdown points at things that aren't in the package.**
- **Evidence:** packages/core/docs carries "*Live demo on the site: …*" placeholders, repo paths (`fixtures/minimal`) and site-only links.
- **Fix:** link the live demo to its site URL, and the repo paths to GitHub.
- **Effort:** S.

**DOCS-40 · P3 · Writing tics.**
- **Evidence:** the bolded "**Why:**" / "**Why this order:**" / "**Why a click never reshapes:**" pattern repeats across Learn (opening-and-linking.mdx:35, fitting.mdx:25, :56, curated-pages.mdx:76). It works, but reads as a formula. There are a few "just" and "simply" (fitting.mdx:31, theming.mdx:38, following.mdx:47).
- **Fix:** keep the reasoning; vary its form, or use one consistent "Why" callout component.
- **Effort:** S.

---

## What is already best in class (keep)

- Samples are real files that get typechecked (`?raw` + `tsc -p apps/docs`), and inline blocks are few. I checked every inline ts/tsx block by hand against `packages/*/src`: event shapes, `ActionResult.settled`, `edgeScroll`, `PaneErrorInfo`, `Overlay`, `LocationPort`, `ActiveItemPort`, `PaneButton`. All are accurate apart from the findings above.
- A test makes every export, action, command, default key, token and icon have a reference entry.
- The docs ship inside the package for each version, with an agent skill (skills/jali/SKILL.md) and a "ten rules" contract page (coding-agents.mdx). No library on the comparison list does this as well.
- The live figures are real Jali workspaces: TreeView with map and JSON, Frame with a ruler, Spotlight, and the home tour. They earn their place on the home page, Key concepts, The layout tree and How a layout fits.
- The prose is plain and concrete, with domain examples (tickets, orders, loans) and almost no marketing words. Introduction and Key concepts are exemplary.
- The example READMEs open with what each app shows and how to try it. Studio's licensing section is unusually careful.
