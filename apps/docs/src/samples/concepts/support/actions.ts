import { ticket } from "./ticket";
import { workspace } from "./store";

// Everything the workspace can do is an action. The pane id comes from the layout.
workspace.actions.openBeside("list", ticket({ id: 103 }));
workspace.actions.focus("detail");
workspace.actions.preset("list");

// Read state, or subscribe to it.
const unsubscribe = workspace.subscribe(() => console.log(workspace.get().view.focused));
unsubscribe();
