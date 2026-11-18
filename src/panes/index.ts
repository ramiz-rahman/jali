import type { Pane } from "@jali/react";
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

/** Data Studio's pane kinds. */
export const dataStudioKinds: readonly Pane[] = [
  catalogKind,
  tableKind,
  recordKind,
  relatedKind,
  queryKind,
  chartKind,
  structureKind,
  erKind,
  auditKind,
];
/** What Split and "New tab here" open in Data Studio. */
export { launcherKind as dataStudioLauncher };
export { dataStudioPresets, DEFAULT_PRESET } from "./presets";
