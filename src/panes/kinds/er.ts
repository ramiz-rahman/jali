import { GitFork } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { ErPane } from "../ErPane";

export const erKind = definePaneKind({
  kind: "er", ref: (params) => ({ kind: "er", params }),
  title: (ref) => `${ref.params.table ?? ""} relations`.trim(), minWidth: 480, minHeight: 240, 
  icon: GitFork, Component: ErPane,
});
