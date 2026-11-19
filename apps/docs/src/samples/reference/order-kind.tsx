import { useState } from "react";
import { definePane, useActivity, useCommands, useUnsaved, type PaneProps } from "@jali/react";
import { FileText } from "lucide-react";

// Declared before the component, so the component is typed from it: params is { id: number }.
const orderNoteParams = { id: Number };

function OrderNote({ params, paused }: PaneProps<typeof orderNoteParams>) {
  const [draft, setDraft] = useState("");
  // Unsaved work: closing or replacing this pane asks first while it is set.
  useUnsaved(draft && "a note that is not saved");
  // Commands in ⌘K while the pane is focused.
  useCommands([
    {
      id: "save",
      title: "Save note",
      keys: "Mod+S",
      disabled: draft ? false : "Nothing to save",
      run: () => setDraft(""),
    },
  ]);
  // What the pane is doing, for its header, tab and the shelf.
  useActivity(paused ? "idle" : "working");
  return (
    <textarea
      aria-label={`Note on order ${params.id}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

export const orderNoteKind = definePane("order-note", {
  params: orderNoteParams,
  title: ({ id }) => `Note on order ${id}`,
  icon: FileText,
  width: { min: 280, max: 640 },
  Component: OrderNote,
});
