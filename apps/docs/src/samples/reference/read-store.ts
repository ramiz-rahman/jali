import { store } from "./store";

// Read, subscribe, act. Actions return the pane they opened, when they open one.
const off = store.subscribe(() => console.log(store.get().view.focused));
const opened = store.actions.openBeside("orders", { kind: "order", params: { id: 1042 } });
store.actions.select("orders", { kind: "order", params: { id: 1043 } });
store.actions.close(opened);
store.model().visible;      // panes on screen, reading order
store.onToast((t) => console.log(t.title, t.undo ? "(Undo)" : ""));
off();
