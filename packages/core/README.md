# @jali/core

> **A workspace package, not published.** Apps install [`jali`](../jali), which is built from this package and its sibling. It stays here for links that point at it (Data Studio's, until it moves to `jali`).

A workspace of panes that fits the space it has. No framework.

- **A layout tree.** Rows, columns and tab stacks of panes; each pane shows one object (a `ref`). Every operation (open beside, close, move, tuck, resize) is a pure function from one layout to the next.
- **Fitting.** Each kind of pane says the narrowest it works at. When the window is too small, panes fold into tabs of their neighbours instead of being crushed, and come back when there is room.
- **A workspace.** Focus, undo, a selected item that a detail pane follows, unsaved work that is never closed without asking, and keyboard commands you can rebind.
- **Ports.** The address and what a person keeps on their device go through small interfaces, so a router or a test can own them.

```ts
import { createJali, row } from "@jali/core";
import { urlSync } from "@jali/core/adapter";

const jali = createJali({
  panes: [orders, order], // your kinds: definePane from @jali/react
  layout: row(orders(), order({ id: 1 })), // two panes side by side
  features: [urlSync()], // the layout in the address: links, Back and Forward, reloads
});

jali.actions.openBeside("orders", order({ id: 2 }));
```

More than one workspace on a page: give each its own `id` (DOM ids and saved keys), its own address params (`urlSync({ prefix: "n." })`) and `keyboard: { scope: "local" }`. A workspace inside a page with its own theme passes `pageTheme: false`.

Render it with [`@jali/react`](../react). Framework adapters import `@jali/core/adapter`.

## Docs

The docs live with the published package: [`packages/jali/docs`](../jali/docs/README.md) (installed, `node_modules/jali/docs/README.md`). A coding agent should read [`get-started/coding-agents.md`](../jali/docs/get-started/coding-agents.md) before writing Jali code.
