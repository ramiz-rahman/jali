import { FileText } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { RecordPane } from "../RecordPane";
import { singular } from "../../data/tables";

export const recordKind = definePaneKind({
  kind: "record", ref: (params) => ({ kind: "record", params }),
  title: (ref) => `${singular(String(ref.params.table ?? "record"))} ${ref.params.id ?? ""}`.trim(), minWidth: 480, minHeight: 240, 
  icon: FileText, Component: RecordPane,
});
