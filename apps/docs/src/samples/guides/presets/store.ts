import { boot, createPaneKinds, createUiStore, createUrlSync, startUi } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "./layouts";

export const store = createUiStore({
  kinds: createPaneKinds(orderKinds),
  presets,             // in menu order: ⌘K lists each one as "Layout: <label>"
  preset: "triage",    // the one to open on when the address has no layout. Default: the first
  url: createUrlSync(),
});

boot(store);
startUi(store);

// Switch from your own buttons or menus. With unsaved work in a pane that would go, the person is asked first.
export const showCustomerDesk = () => store.actions.preset("customer-desk");
// Rebuild the preset in use, as ⌘K "Reset layout" does.
export const resetLayout = () => store.actions.resetLayout();
