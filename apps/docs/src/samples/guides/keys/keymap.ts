import { createJali } from "jali-layout";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const jali = createJali({
  panes: orderKinds,
  presets,
  keyboard: {
    keymap: {
      "pane.close": "Mod+K Mod+X", // rebind: replaces the default
      "pane.zoom": ["Mod+Shift+Enter", "Mod+K Mod+Enter"], // several bindings: the first is the one shown
      "pane.split.down": null, // unbind
      "palette.toggle": ["Mod+K", "Mod+Shift+Space"], // the palette
      "pane.close_others": "Mod+K Shift+Mod+Backspace", // a command with no default key
    },
    // A refused binding (a bare letter, three steps, an unknown key) is reported here. Default: console.warn.
    onInvalid: (id, binding, reason) =>
      console.error(`Keymap: ${id} "${binding}" ignored: ${reason}`),
  },
});

// What a tooltip or menu prints: "⌘K ⌘X" on a Mac, "Ctrl+K Ctrl+X" elsewhere; "" when unbound.
export const closeLabel = jali.keymap.label("pane.close");
