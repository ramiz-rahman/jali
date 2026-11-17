import { Table2 } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { TablePane } from "../TablePane";

export const tableKind = definePaneKind({
  kind: "table", ref: (params) => ({ kind: "table", params }),
  title: (ref) => String(ref.params.table ?? "Table"), minWidth: 480, minHeight: 240, heavy: true,
  icon: Table2, Component: TablePane,
});
