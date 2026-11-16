import { BarChart3, Database, FileText, GitFork, History, Link2, ListTree, Plus, Table2, TerminalSquare } from "lucide-react";
import { registerPaneKind } from "../ui/pane-kinds";
import { AuditPane } from "./AuditPane";
import { CatalogPane } from "./Catalog";
import { ChartPane } from "./ChartPane";
import { ErPane } from "./ErPane";
import { LauncherPane } from "./LauncherPane";
import { QueryPane } from "./QueryPane";
import { RecordPane } from "./RecordPane";
import { RelatedPane } from "./RelatedPane";
import { StructurePane } from "./StructurePane";
import { TablePane } from "./TablePane";
import { titleFor } from "./format";

let done = false;

/** Registers every pane kind. Idempotent. Call before first render. */
export function registerAllPaneKinds(): void {
  if (done) return;
  done = true;
  registerPaneKind({ kind: "catalog", title: titleFor, minWidth: 240, minHeight: 200, icon: Database, Component: CatalogPane });
  registerPaneKind({ kind: "table", title: titleFor, minWidth: 480, minHeight: 240, heavy: true, icon: Table2, Component: TablePane });
  registerPaneKind({ kind: "record", title: titleFor, minWidth: 480, minHeight: 240, icon: FileText, Component: RecordPane });
  registerPaneKind({ kind: "related", title: titleFor, minWidth: 380, minHeight: 240, icon: Link2, Component: RelatedPane });
  registerPaneKind({ kind: "query", title: titleFor, minWidth: 480, minHeight: 280, heavy: true, icon: TerminalSquare, Component: QueryPane });
  registerPaneKind({ kind: "chart", title: titleFor, minWidth: 380, minHeight: 220, icon: BarChart3, Component: ChartPane });
  registerPaneKind({ kind: "structure", title: titleFor, minWidth: 440, minHeight: 240, icon: ListTree, Component: StructurePane });
  registerPaneKind({ kind: "er", title: titleFor, minWidth: 480, minHeight: 240, icon: GitFork, Component: ErPane });
  registerPaneKind({ kind: "launcher", title: titleFor, minWidth: 320, minHeight: 200, icon: Plus, Component: LauncherPane });
  registerPaneKind({ kind: "audit", title: titleFor, minWidth: 380, minHeight: 240, icon: History, Component: AuditPane });
}
