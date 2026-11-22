import { createJali } from "jali";
import { launcher, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { chooser } from "jali/chooser";
import { settings } from "jali/settings";
import { urlSync } from "jali/url";

export const jali = createJali({
  panes: orderKinds,
  launcher,
  presets,
  // No palette() among the features: your app's ⌘K menu lists Jali's commands (HostCommandMenu.tsx)
  features: [urlSync(), settings(), chooser()],
  keyboard: {
    prefix: "Mod+J", // Jali's two-step keys start with ⌘J: ⌘J ⌘Z restores a closed pane
    reserved: ["Mod+K", "Mod+/", "Mod+Shift+F"], // your app's own: Jali never binds these
    scope: "local", // only keys pressed inside the panes
    // Each of Jali's bindings that a reserved key pushed out is reported here, once, at start-up.
    onInvalid: (id, binding, reason) =>
      console.warn(`Jali: ${id} "${binding}" not bound: ${reason}`),
  },
});
