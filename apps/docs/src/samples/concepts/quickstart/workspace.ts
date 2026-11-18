import { createWorkspace, row } from "@jali/core";
import { note } from "./note";

export const workspace = createWorkspace({
  panes: [note],
  layout: row(note({ id: 1 }), note({ id: 2 })),
});
