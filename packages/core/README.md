# @jali/core

A workspace of panes that fits the space it has. No framework.

- **A layout tree.** Rows, columns and tab stacks of panes; each pane shows one object (a `ref`). Every operation (open beside, close, move, tuck, resize) is a pure function from one layout to the next.
- **Fitting.** Each kind of pane says the narrowest it works at. When the window is too small, panes fold into tabs of their neighbours instead of being crushed, and come back when there is room.
- **A workspace.** Focus, undo, a selected item that a detail pane follows, unsaved work that is never closed without asking, and keyboard commands you can rebind.
- **Ports.** The address and what a person keeps on their device go through small interfaces, so a router or a test can own them.

```ts
import { createWorkspace, row } from "@jali/core";

const workspace = createWorkspace({
  panes: [orders, order],                         // your kinds: definePane from @jali/react
  layout: row(orders(), order({ id: 1 })),        // two panes side by side, kept in the address
});

workspace.actions.openBeside("orders", order({ id: 2 }));
```

Render it with [`@jali/react`](../react). Framework adapters import `@jali/core/adapter`.
