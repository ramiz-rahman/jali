import { useState } from "react";
import { definePane, useActivity, useCommands, useUnsaved, type PaneProps } from "@jali/react";
import { FileTextIcon } from "@phosphor-icons/react";

function OrderNote({ params, paused }: PaneProps<{ id: number }>) {
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
  params: { id: Number },
  title: ({ id }) => `Note on order ${id}`,
  icon: FileTextIcon,
  width: { min: 280, max: 640 },
  Component: OrderNote,
});
