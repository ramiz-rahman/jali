# @jali/core

A workspace of panes that fits the space it has. No framework.

- **A layout tree.** Rows, columns and tab stacks of panes; each pane shows one object (a `ref`). Every operation (open beside, close, move, tuck, resize) is a pure function from one layout to the next.
- **Fitting.** Each kind of pane says the narrowest it works at. When the window is too small, panes fold into tabs of their neighbours instead of being crushed, and come back when there is room.
- **A store.** Focus, undo, a selected item that a detail pane follows, unsaved work that is never closed without asking, and keyboard commands you can rebind.
- **Ports.** The address and what a person keeps on their device go through small interfaces, so a router or a test can own them.

```ts
import { boot, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";

const store = createUiStore({
  kinds: createPaneKinds([/* your kinds: definePaneKind from @jali/react */]),
  presets: [{ id: "start", label: "Start", build: () => myLayout }],
  url: createUrlSync(),          // the layout lives in the address; Back and Forward step through it
});
boot(store);                     // the first layout, before the first render
startUi(store);                  // keyboard, Back/Forward, theme and saving, for the life of the page
```

More than one workspace on a page: give each store its own `id` (DOM ids and saved keys) and URL `prefix`, and start each with `startUi(store, { root: store.dom.root })`. A host with its own theme passes `theme: false`.

Render it with [`@jali/react`](../react). Framework adapters import `@jali/core/adapter`.
