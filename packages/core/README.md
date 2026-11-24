# @jali/core

The framework-free half of [`jali-layout`](../jali): an internal workspace package, never published. Apps install `jali-layout` (this package is its root entry, `jali-layout`, and `jali-layout/adapter` for framework adapters); [its README](../jali/README.md) is the guide for them. This one is for working on the package.

A layout of panes that fits the space it has, with no framework:

- **A layout tree.** Rows, columns and tab stacks of panes; each pane shows one object (a `ref`). Every operation (open beside, close, move, tuck, resize) is a pure function from one layout to the next (`src/layout/`).
- **Fitting.** Each kind of pane says the narrowest it works at. When the window is too small, panes fold into tabs of their neighbours instead of being crushed, and come back when there is room.
- **An instance.** Focus, undo, a selected item that a detail pane follows, unsaved work that is never closed without asking, and keyboard commands you can rebind (`src/actions/`, `src/state/`, `src/commands/`).
- **Ports.** The address and what a person keeps on their device go through small interfaces, so a router or a test can own them (`src/ports.ts`, `src/url.ts`).

An adapter (`@jali/react` is the one Jali ships) draws what the core decides: it measures the panes' element (`store.measure`), renders the model, and sends what people do back as actions.

## Docs

The docs live with the published package: [`packages/jali/docs`](../jali/docs/README.md) (installed, `node_modules/jali-layout/docs/README.md`). A coding agent should read [`get-started/coding-agents.md`](../jali/docs/get-started/coding-agents.md) before writing Jali code.
