import { createWorkspace } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "./layouts";

export const workspace = createWorkspace({
  panes: orderKinds,
  presets, // in menu order: ⌘K lists each one as "Layout: <label>"
  preset: "triage", // the one to open on when the address has no layout. Default: the first
});

// Switch from your own buttons or menus. With unsaved work in a pane that would go, the person is asked first.
export const showCustomerDesk = () => workspace.actions.preset("customer-desk");
// Rebuild the preset in use, as ⌘K "Reset layout" does.
export const resetLayout = () => workspace.actions.resetLayout();
