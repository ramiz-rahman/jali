import { ListTree } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { StructurePane } from "../StructurePane";

export const structureKind = definePaneKind({
  kind: "structure", ref: (params) => ({ kind: "structure", params }),
  title: (ref) => `${ref.params.table ?? ""} structure`.trim(), minWidth: 440, minHeight: 240, 
  icon: ListTree, Component: StructurePane,
});
