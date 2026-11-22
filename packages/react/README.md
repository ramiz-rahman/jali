# @jali/react

The React half of [`jali`](../jali): an internal workspace package, never published. Apps install `jali` and import `jali/react`; [its README](../jali/README.md) is the guide for them. This one is for working on the package.

## Where things are

- `src/index.ts` is the public surface (`jali/react` re-exports it name by name). `src/internal.ts` adds what the published package needs beyond it: the features and `defaultFeatures`.
- `src/JaliRoot.tsx`: the root, `<JaliView>` and the dialog layer.
- `src/state/`: the store's React hooks (`react.tsx`), hydration and the per-instance lifetime (`InstanceScope`).
- `src/workspace/`: the panes (`Workspace.tsx` composes them), their element's measurement, placement, rows that scroll, stacked view, drags and full screen.
- `src/pane/`: a pane's frame, header, tabs and menu. `content.tsx` is the one place that decides where a pane's content renders (`PaneOutlet`); `actions.ts` is the pane-action model the header and the menu share.
- `src/page/`: the curated page (`definePage`, its contract and its parts).
- `src/chrome/`, `src/dialogs/`, `src/dividers/`, `src/a11y/`, `src/icons/`: the shelf, switcher and peek; the dialogs; dividers; shared keyboard and focus primitives; icons.
- `src/features/`: the opt-in features (`palette()`, `rename()`, `popOut()`, `pressed()` ...) and the typed map of the parts they render (`feature-parts.ts`).
- `src/styles/`: one stylesheet per part, all in the `jali` cascade layer (`index.css` is `jali/styles.css`).
- `src/parts.ts`: the catalogue of public parts (classes and data attributes) the docs and tests read.

The rules this package keeps: the core decides and the adapter draws; one React lifetime per instance; nothing in the core holds a dialog or a part the instance doesn't have. The root `ARCHITECTURE.md` and `docs/DECISIONS.md` say why.

## Developing

`vp test run --project react` runs the tests (`tests/`, jsdom). The packages resolve to their source through the `source` condition, never a stale `dist/`.

**Linked or in a monorepo** (`link:`, `file:`, `workspace:` or a symlinked checkout): the package can resolve its own copy of React from beside its source, and the app then bundles two Reacts, which breaks hooks ("Invalid hook call"). With Vite, tell it to use the app's: `resolve: { dedupe: ["react", "react-dom"] }`. With webpack, alias `react` and `react-dom` to the app's copy.
