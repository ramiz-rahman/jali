import { ticket } from "./ticket";
import { jali } from "./store";

// Every change is an action. The pane id comes from the layout.
jali.actions.openBeside("list", ticket({ id: 103 }));
jali.actions.focus("detail");
jali.actions.preset("list");

// Read state, or subscribe to it.
const unsubscribe = jali.subscribe(() => console.log(jali.get().view.focused));
unsubscribe();
