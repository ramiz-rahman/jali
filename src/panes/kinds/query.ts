import { TerminalSquare } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { QueryPane } from "../QueryPane";

export const queryKind = definePaneKind({
  kind: "query", ref: (params) => ({ kind: "query", params }),
  title: (_ref) => "Query", minWidth: 480, minHeight: 280, heavy: true, identity: () => undefined,
  icon: TerminalSquare, Component: QueryPane,
});
