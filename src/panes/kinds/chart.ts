import { BarChart3 } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { ChartPane } from "../ChartPane";

export const chartKind = definePaneKind({
  kind: "chart", ref: (params) => ({ kind: "chart", params }),
  title: (_ref) => "Chart", minWidth: 380, minHeight: 220, recordable: (ref) => !!ref.params.runId,
  icon: BarChart3, Component: ChartPane,
});
