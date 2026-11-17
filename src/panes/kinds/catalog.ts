import { Database } from "lucide-react";
import { definePaneKind } from "../../ui/pane-kinds";
import { CatalogPane } from "../Catalog";

export const catalogKind = definePaneKind({
  kind: "catalog", ref: (params) => ({ kind: "catalog", params }),
  title: (_ref) => "Tables", minWidth: 240, minHeight: 200, 
  icon: Database, Component: CatalogPane,
});
