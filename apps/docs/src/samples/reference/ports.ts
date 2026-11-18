import { boot, createPaneKinds, createUiStore, createUrlSync, memoryLocation, memoryStorage } from "@jali/core";
import { orderKind } from "./kinds";

// A workspace with no browser: an address and storage in memory, and no DOM focus.
const location = memoryLocation();
const store = createUiStore({
  kinds: createPaneKinds([orderKind]),
  initial: { layout: { version: 1, root: { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "order", params: { id: 1041 } } } } },
  url: createUrlSync({ location, storage: memoryStorage() }),
  storage: memoryStorage(),
  focusPane: null,
});
boot(store);

location.entries;            // every address the workspace pushed or replaced
location.visit("?tab=2");   // navigation from outside: subscribers (Back and Forward handling) hear it
