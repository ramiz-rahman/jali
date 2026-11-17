import { History } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { AuditPane } from "../AuditPane";

export const auditKind = definePaneKind({
  kind: "audit", ref: (params) => ({ kind: "audit", params }),
  title: (_ref) => "Audit log", minWidth: 380, minHeight: 240, 
  icon: History, Component: AuditPane,
});
