import { Link2 } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { RelatedPane } from "../RelatedPane";

export const relatedKind = definePaneKind({
  kind: "related", ref: (params) => ({ kind: "related", params }),
  title: (ref) => String(ref.params.label ?? "Related"), minWidth: 380, minHeight: 240, 
  icon: Link2, Component: RelatedPane,
});
