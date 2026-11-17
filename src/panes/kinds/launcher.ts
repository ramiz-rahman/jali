import { Plus } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { LauncherPane } from "../LauncherPane";

export const launcherKind = definePaneKind({
  kind: "launcher", ref: (params) => ({ kind: "launcher", params }),
  title: (_ref) => "New pane", minWidth: 320, minHeight: 200, transient: true, recordable: false, identity: () => undefined,
  icon: Plus, Component: LauncherPane,
});
