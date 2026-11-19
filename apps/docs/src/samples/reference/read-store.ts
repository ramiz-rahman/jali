import { orderKind } from "./kinds";
import { store } from "./store";

// Read, subscribe, act. An action says what it did: the pane it opened, or why it did not.
const off = store.subscribe(() => console.log(store.get().view.focused));
const opened = store.actions.openBeside("orders", orderKind({ id: 1042 }));
if (!opened.ok) console.log(opened.reason); // "not-found", "unsaved", …
store.actions.select("orders", orderKind({ id: 1043 }));
store.actions.close(orderKind({ id: 1042 })); // a pane by what it shows
store.on("open", ({ pane, ref }) => console.log("opened", pane, ref.params));
store.model().visible; // panes on screen, reading order
store.onToast((t) => console.log(t.title, t.undo ? "(Undo)" : ""));
off();
