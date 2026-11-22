import { createJali } from "@jali/core";
import { launcher, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const jali = createJali({
  panes: orderKinds,
  launcher,
  presets,
  palette: false, // your app's ⌘K menu lists Jali's commands (HostCommandMenu.tsx)
  keyboard: {
    prefix: "Mod+J", // Jali's two-step keys start with ⌘J: ⌘J ⌘Z restores a closed pane
    reserved: ["Mod+K", "Mod+/", "Mod+Shift+F"], // your app's own: Jali never binds these
    scope: "local", // only keys pressed inside the panes
    // Each of Jali's bindings that a reserved key pushed out is reported here, once, at start-up.
    onInvalid: (id, binding, reason) =>
      console.warn(`Jali: ${id} "${binding}" not bound: ${reason}`),
  },
});
