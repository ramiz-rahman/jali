/** Data Studio's workspace: a database browser where the person builds the layout from its pane kinds and presets. */
import { createJali, type Jali, type JaliOptions, type TabMenu } from "jali-layout";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { reportPaneError } from "@jali-examples/shared/shell/report";
import { DEFAULT_PRESET, dataStudioKinds, dataStudioLauncher, dataStudioPresets } from "./panes";
import { queryKind } from "./panes/kinds/query";
import { structureKind } from "./panes/kinds/structure";
import { defaultFeatures } from "jali-layout/features";
import { popOut } from "jali-layout/pop-out";
import { urlSync } from "jali-layout/url";

/** What Data Studio's workspace is made of. */
export const dataStudioOptions = {
  panes: dataStudioKinds,
  launcher: dataStudioLauncher,
  presets: dataStudioPresets,
  preset: DEFAULT_PRESET,
  name: "Data Studio",
  storage: "data-studio",
  // The app is the whole page and has no <main> of its own: the panes are it.
  landmark: "main",
  // In Data Studio, the only unsaved work is a query's edit that hasn't run (query.tsx): Jali's question says so.
  messages: {
    confirmDiscard: {
      body: (count: number) =>
        count === 1
          ? "This query has an edit that hasn't run. It will be lost."
          : "These queries have edits that haven't run. They will be lost.",
    },
  },
} satisfies JaliOptions;

/** A table's tab menu, after Jali's items: its structure, and a new query of it, beside it. */
export const tableMenu =
  (jali: () => Jali): TabMenu =>
  ({ ref }) => {
    if (ref.kind !== "table") return undefined;
    const table = String(ref.params.table);
    return [
      {
        id: "structure",
        title: "Show its structure",
        run: ({ id }) => jali().actions.openBeside(id, structureKind({ table })),
      },
      {
        id: "query",
        title: "Query this table",
        run: ({ id }) =>
          jali().actions.openBeside(id, queryKind({ sql: `SELECT *\nFROM ${table}\nLIMIT 100` })),
      },
    ];
  };

/** What a test gives in place of the browser's: an address and storage in memory, a fixed size. */
type Options = Pick<JaliOptions, "features" | "storage" | "size" | "moveFocus">;

/** Links reopen exactly, sizes included (the founder's round-trip rule, 17 Nov). */
export const createDataStudio = (options: Options = {}): Jali => {
  const jali: Jali = createJali({
    ...dataStudioOptions,
    ...options,
    // Jali's usual features, links with every size, and Pop out: among Jali's header buttons, before Close, and
    // Jali's "Pop out pane" in ⌘K (Document Picture-in-Picture; Chrome and Edge on desktop). A test's own (its
    // address in memory) take their places.
    features: [
      ...defaultFeatures(),
      urlSync({ sizes: "link" }),
      popOut(),
      ...(options.features ?? []),
    ],
    commands: [makerCommand],
    tabMenu: tableMenu(() => jali),
    onPaneError: reportPaneError(() => jali),
  });
  return jali;
};
