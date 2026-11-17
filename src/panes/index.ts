import { registerPaneKind } from "../ui/pane-kinds";
import { catalogKind } from "./kinds/catalog";
import { tableKind } from "./kinds/table";
import { recordKind } from "./kinds/record";
import { relatedKind } from "./kinds/related";
import { queryKind } from "./kinds/query";
import { chartKind } from "./kinds/chart";
import { structureKind } from "./kinds/structure";
import { erKind } from "./kinds/er";
import { launcherKind } from "./kinds/launcher";
import { auditKind } from "./kinds/audit";

let done = false;
export function registerAllPaneKinds(): void {
  if (done) return;
  done = true;
  registerPaneKind(catalogKind);
  registerPaneKind(tableKind);
  registerPaneKind(recordKind);
  registerPaneKind(relatedKind);
  registerPaneKind(queryKind);
  registerPaneKind(chartKind);
  registerPaneKind(structureKind);
  registerPaneKind(erKind);
  registerPaneKind(launcherKind);
  registerPaneKind(auditKind);
}
