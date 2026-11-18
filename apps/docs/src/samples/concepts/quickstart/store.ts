import { boot, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";
import { note } from "./note";
import { start } from "./start";

export const store = createUiStore({
  kinds: createPaneKinds([note]),
  presets: [{ id: "start", label: "Start", build: start }],
  url: createUrlSync(),
});

boot(store);    // the first layout, before the first render
startUi(store); // keyboard, Back and Forward, theme and saving, for the life of the page
