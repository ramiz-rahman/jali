# Jali's public API: the review before 1.0

> **Approved by the owner, 22 Nov 2026,** including all four calls below. This is the target public surface, written as code. Nothing here is built yet; the API phase builds it after phases 1 and 2 merge. Phases 1 and 2 (correctness) don't change the public API, so they go on alongside this review.
>
> **Sources:**
>
> - The six reviews of 22 Nov in `reviews/2026-11-22/`: core-opus CORE-6, 7, 9, 13 and 14; react-opus REACT-12, 13, 15 and 16; core-codex CORE-13, 14 and 17; docs-opus DOCS-9 and 25.
> - The Effect research in `research/effect.md`.
> - The naming decisions of 19 Nov in DECISIONS.
>
> **Checked against:** the five examples (Data Studio, Loan review, Markets, Studio, Trips), the minimal app, Data Studio in `sixface/products/data-studio`, and the research portal.

## What stays

The reviews agree on what is already right. None of it changes:

- **The pure layout engine** and the layout builders: `row`, `column`, `tabs`, `pane`.
- **`apply()` and its typed refusals.** Every action returns an `ActionResult`; nothing throws at a person's click.
- **`definePane` returns a callable kind,** so `note({ id: 2 })` is a typed ref.
- **One external store**, read through narrow selectors.
- **The ports:** location, storage, DOM and the active item.
- **The parts contract**, the `--jali-*` tokens and the `jali` cascade layer.
- **In-house accessibility primitives,** with no runtime dependencies.

## The ten changes

### 1. One package, `jali`, with subpaths

```ts
import { createJali, definePane, row } from "jali";
import { JaliRoot } from "jali/react";
import "jali/styles.css";
```

| Subpath                                                                | What it holds                                                               | Today                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `jali`                                                                 | Kinds, layouts, `createJali`, actions, ports, commands                      | `@jali/core`                                             |
| `jali/react`                                                           | `<JaliRoot>`, `definePane`, hooks, chrome parts                             | `@jali/react`                                            |
| `jali/page`                                                            | `definePage`, opt-in                                                        | both packages export one (REACT-13)                      |
| `jali/agent`                                                           | The agent bridge                                                            | `@jali/core/agent`                                       |
| `jali/testing`                                                         | `createTestJali`, `pressKeys`, `unsavedOf`: what an app's tests need        | apps import `storeOf` from `@jali/core/adapter` (DOCS-9) |
| `jali/adapter`                                                         | For people writing a framework adapter; **may change in any minor version** | `@jali/core/adapter`                                     |
| `jali/icons`, `jali/styles.css`, `jali/theme.css`, `jali/tailwind.css` | As today                                                                    | `@jali/react/…`                                          |

- **Why one package:** it can be transferred to another owner without changing anyone's imports. There is one version and one install line, and React is an optional peer. The repo keeps `packages/core` and `packages/react` as the source folders; only how they are published changes.
- **What breaks:** every import. Data Studio and the research portal get the list of moves first.

### 2. Features are opt-in, so an app ships only what it uses

Today every app ships the URL sync (on by default), the command registry, the palette, rename, the phone layout and every English message. Together they are most of the 52 KB of the minimal core; the fitting engine itself is about 10 KB (core-opus CORE-9). `definePage` already shows the fix: a feature is a value you pass, and its code arrives with it.

```ts
// Before
const jali = createJali({ panes: [note], layout, url: true, palette: true, rename: { run } });

// After
import { createJali } from "jali";
import { urlSync } from "jali/url";
import { palette } from "jali/palette";
import { rename } from "jali/rename";

const jali = createJali({
  panes: [note],
  layout,
  features: [urlSync(), palette(), rename({ run })],
});
```

- **Each feature brings its own words.** The English messages split by feature, as the curated page's already do, so a minimal app doesn't ship 12.8 KB of strings it never shows.
- **What stays in every app:** layout, fitting, actions, focus, undo, follow, the keyboard and the minimal chrome's words.
- **Target sizes,** estimated by the reviewers and not yet measured: core 25–30 KB, down from 52; React 17–18 KB, down from 24.5. The size gate gets a budget for each feature.
- **The trade-off:** the minimal app's import list grows by a line or two. `jali/presets` can offer `defaultFeatures()` for an app that wants everything, which is one import with today's behaviour.

### 3. Types flow from the kinds you register

Today, types stop at the kind. `jali.on("open", ({ ref }) => ref.params.id)` is `string | number | boolean`, and `openBeside(p, { kind: "ordr" })` compiles (CORE-6).

```ts
const jali = createJali({ panes: [note, order] });

jali.actions.openBeside(pane, order({ id: 7 })); // ✓
jali.actions.openBeside(pane, { kind: "ordr", params: {} }); // ✗ type error: no kind "ordr"
jali.on("open", ({ ref }) => {
  if (ref.kind === "order") ref.params.id; // number
});

// React infers the instance through one declaration, as TanStack Router does:
declare module "jali" {
  interface Register {
    jali: typeof jali;
  }
}
const params = usePane(order).params; // { id: number }, with no cast
```

- **`ObjectRef` stays as the wide type** for links and agents, which can name anything.
- **Cost:** types only, with no runtime bytes.

### 4. Params accept Standard Schema

```ts
// Today, still supported:
definePane("order", { params: { id: Number, tab: optional(String), autorun: appOnly(Boolean) } });

// Also accepted: any Standard Schema (Effect Schema, Valibot, Zod, ArkType):
definePane("order", { params: v.object({ id: v.number(), tab: v.optional(v.string()) }) });
```

- **Jali's own constructors stay the default,** at zero dependencies and a few hundred bytes.
- **A host that already validates with a schema library** uses it, and pays for nothing extra. This is how Effect users plug in (research/effect.md).
- **The address is unchanged:** a schema decides what is valid; Jali's codec still decides how it is written in a link.

### 5. Actions: one path, grouped by what they act on

There are 43 actions on one object today. Eight of them are curated-page actions, which sit on every instance and are refused at runtime without a page. Behind them, a second internal table of 80 steps throws its refusals away (core-opus CORE-7 and CORE-13).

```ts
jali.actions.openBeside(pane, ref); // panes and layout, as today
jali.page?.showView("summary"); // only present, and only typed, when a page is given
jali.page?.setMode("split");
jali.dialogs.openPalette(); // palette, settings and chooser together
```

| Today                                                                                | After                                                                         |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `openPage`, `leavePage`, `setMode`, `openTab`, `activate`, `backToPage`, `resetPage` | `jali.page.open`, `leave`, `setMode`, `showView`, `showItem`, `back`, `reset` |
| `setCanInvestigate` (Loan review's word)                                             | `jali.page.setLinkMode("open" \| "peek")`                                     |
| `openTab` / `addTab` / `newTab`, three meanings of "tab"                             | `page.showView` / `addTab` / `newTab`                                         |
| `openPalette`, `closePalette`, `openSettings`, `closeSettings`                       | `jali.dialogs.*`                                                              |

- **Inside,** one table of steps, with each step naming its public action. Adapters and apps go through the same `run(name, …)`, so every refusal reaches whoever asked, and the `NAMED_AS` reconciliation table disappears.

### 6. One way to listen

| Today                                       | After                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `subscribe(fn)`, for any change             | Stays: it is the store contract that `useSyncExternalStore` needs                                              |
| `on(event, fn)`                             | Stays                                                                                                          |
| `onToast(fn)`                               | Becomes `on("toast", fn)`                                                                                      |
| A `useEffect` in every app around `jali.on` | `useJaliEvent("open", handler)` in React, which always calls the latest handler and stops listening on unmount |

### 7. Options grouped where they belong together

`JaliOptions` has 37 flat options. Most read fine flat. Only the keyboard options are scattered: six of them, plus a group that covers part of the same ground (CORE-13).

```ts
// Before
createJali({
  keys: "scoped",
  keymap,
  keyPrefix: "mod+k",
  reservedKeys: ["F2"],
  palette: true,
  keymapOptions,
});

// After
createJali({ keyboard: { scope: "local", keymap, prefix: "mod+k", reserved: ["F2"] } });
```

- **`scope: "page" | "local"`** replaces `keys: "page" | "scoped"`, because "scoped" doesn't say scoped to what.
- **Inside,** the options are resolved once into one config. Today they are copied by hand through three shapes, about 45 fields documented three times, and the copies have drifted (CORE-7).

### 8. React: one root, and composing uses the same root

Today `<JaliProvider>`, `<Panes>`, `<Palette>`, `<SettingsPanel>` and the other parts are exported "to compose your own". That path silently loses what the root does (react-opus REACT-12):

- the dialog layer;
- tokens;
- direction;
- the full-screen portal;
- the inert overlays.

No example uses it.

```tsx
// The common case, as today:
<JaliRoot jali={jali} />

// Your own chrome, also as today: children around <JaliView />.
<JaliRoot jali={jali}>
  <AppBar />
  <JaliView />
  <Shelf />
</JaliRoot>
```

- **`<JaliProvider>` and the bare dialog parts become internal.** About 41 public values drop to about 34.
- **One root carries every duty,** so every way of using Jali gets them all.
- **Slots for the chrome Jali draws:** `settingsExtra`, `overlays`, `icons`.

### 9. Names, before they are permanent

| Today                                           | After                                                                | Why                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `useTheme`, `useShortcut`                       | `useJaliTheme`, `useJaliShortcut`                                    | They collide with next-themes and MUI in host code                   |
| `keyBelongsToContent` in React                  | Moves to `jali`, re-exported by `jali/react`                         | It doesn't use React                                                 |
| `usePane<P>()`, an unchecked cast               | `usePane(kind)`                                                      | Infers the params                                                    |
| `definePage` in both packages                   | Only `jali/page`                                                     | Core's version renders nothing in React, silently                    |
| `env`, `keymap` and `messages` on the instance  | Stay, documented as read-only                                        |                                                                      |
| Mutating tree aliases, `isMac`, `setPopOutPort` | Removed                                                              | Deprecated; removing them now saves keeping them until 2.0 (CORE-14) |
| "workspace" in prose and copy                   | "Jali" as the subject, "panes" and "layout" for what the person sees | DECISIONS, 19 Nov; owner, 22 Nov                                     |
| The default name "Workspace"                    | The app's name, or no name                                           | Same                                                                 |
| Internal `UiStore`, `createUiStore`             | `JaliStore`                                                          | Same                                                                 |

### 10. Lifecycle, said once

`start()` returns a stop function, and `destroy()` also exists. Phase 1 makes `destroy()` cancel everything still pending. After that, the rule is:

- **`<JaliRoot>` starts and stops the instance itself.**
- **Outside React, `jali.start()` returns `stop`;** you can start it again later.
- **`jali.destroy()` is the end.** Every pending question, timer and listener is cancelled, and every call after it is refused.

## What the quickstart looks like after

```tsx
import { createRoot } from "react-dom/client";
import { createJali, definePane, row } from "jali";
import { JaliRoot } from "jali/react";
import "jali/styles.css";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params, openBeside }) => (
    <article>
      <h3>Note {params.id}</h3>
      <button type="button" onClick={() => openBeside(note({ id: params.id + 1 }))}>
        Open the next note beside
      </button>
    </article>
  ),
});

const jali = createJali({ panes: [note], layout: row(note({ id: 1 }), note({ id: 2 })) });

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
```

- **The same as today except the imports.** `definePane` moves to `jali` because it no longer needs React to define a kind. The React component is attached by `jali/react` when it renders.
- **Two people decide whether that move is right:** the owner, and a check that the framework-free core doesn't pull in React types.

## Decided by the owner (22 Nov 2026: yes to all four)

The rest follows from the reviews and DECISIONS; these four were judgement calls.

1. **Opt-in features (2):** do you accept a slightly longer setup in exchange for core at roughly half its size? **Recommended: yes**, with `defaultFeatures()` for anyone who wants today's behaviour in one line.
2. **`definePane` in `jali` rather than `jali/react` (quickstart):** this keeps kinds framework-free, which a later Solid or Vue adapter would need. **Recommended: yes**, if the types stay clean. Otherwise it stays in `jali/react`.
3. **Remove the compose-your-own path (8):** **Recommended: yes.** No example uses it, and it is the main source of silent bugs.
4. **`keyboard.scope: "page" | "local"` (7):** you may prefer a different word for "only while focus is inside this Jali". `"local"` is short, and its meaning is obvious next to `"page"`.

## How the API phase runs once this is approved

1. **Write the types first,** with the quickstart, a curated page and custom chrome as type tests (`expectTypeOf`). A type error in a sample fails the build.
2. **Move the five examples,** the minimal app and the docs samples onto the new API in the same branch as the change.
3. **Data Studio and the research portal get a migration note** before the branch merges: every import, option and action move, old name to new.
4. **Measure the bytes per feature,** and set the size budgets from the measurements.
5. **Then the docs phase,** written once, in the final words.
