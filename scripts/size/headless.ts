/** Size scenario: the workspace without React (a host that renders it some other way, or a test). */
import { createJali, listCommands, row } from "@jali/core";

const note = { kind: "note", title: "Note" };
const jali = createJali({ panes: [note], layout: row({ kind: "note", params: { id: 1 } }) });
jali.start();
document.body.textContent = listCommands(jali)
  .map((c) => c.title)
  .join("\n");
