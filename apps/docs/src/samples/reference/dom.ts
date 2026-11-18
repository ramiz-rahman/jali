import { focusPane, paneDomId, paneTitleId } from "@jali/core";
import { store } from "./store";

paneDomId(store.dom.id, "orders");     // "jali-pane-orders"
paneTitleId(store.dom.id, "orders");   // "jali-pane-orders-title"

// Move DOM focus into a pane after the next paint (what the store does after an action that moves focus).
focusPane(store.dom, "orders");
