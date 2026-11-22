import { createJali, memoryLocation, memoryStorage } from "jali";
import { launcherKind, orderKind, ordersKind } from "./kinds";
import { palette } from "jali/palette";
import { urlSync } from "jali/url";

export const jali = createJali({
  panes: [ordersKind, orderKind], // the kinds of pane it can show
  layout: ordersKind(), // the layout it opens on (or `presets`)
  launcher: launcherKind, // what Split opens: without one there is no Split
  name: "Sales desk", // in commands such as "Open Sales desk"
  features: [urlSync({ prefix: "a.", sizes: "link" }), palette()], // each a value from its own module
  storage: "sales", // localStorage keys "sales:…", or a StoragePort
  id: "sales", // DOM ids "sales-pane-…"
  keyboard: { scope: "local", keymap: { "pane.close": "Mod+K Mod+X" } }, // only keys pressed inside it
  pageTheme: false, // leave data-theme on <html> to the page
});

// With no browser (a test, the server): the address and storage in memory, a fixed size, DOM focus left alone.
const location = memoryLocation();
export const inMemory = createJali({
  panes: [orderKind],
  layout: orderKind({ id: 1041 }),
  features: [urlSync({ location })],
  storage: memoryStorage(),
  size: { width: 1440, height: 900 },
  moveFocus: false,
});

location.entries; // every address Jali pushed or replaced
location.visit("?tab=2"); // navigation from outside: Jali hears it, as it hears Back and Forward
