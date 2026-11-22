import { createJali, row } from "jali";
import { note } from "./note";

export const jali = createJali({
  panes: [note],
  layout: row(note({ id: 1 }), note({ id: 2 })),
});
