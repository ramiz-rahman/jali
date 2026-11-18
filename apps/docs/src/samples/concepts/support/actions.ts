import { store } from "./store";

// Everything the workspace can do is an action on the store. The pane id comes from the layout.
store.actions.openBeside("list", { kind: "ticket", params: { id: 103 } });
store.actions.focus("detail");
store.actions.tuck("who");
store.actions.preset("list");

// Read state, or subscribe to it.
const unsubscribe = store.subscribe(() => console.log(store.get().view.focused));
unsubscribe();
