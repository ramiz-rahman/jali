import { useState } from "react";
import { keyHint } from "jali";
import { definePane, useCommands, usePaneState, useUnsaved, type PaneProps } from "jali/react";
import { noteBody, saveNote } from "./data";

const noteParams = { id: Number };

function NoteEditor({ params }: PaneProps<typeof noteParams>) {
  const [saved, setSaved] = useState(() => noteBody(params.id));
  // The draft is pane state: it survives a fold, a tab switch, a tuck and a reload, and goes when the pane closes.
  const [draft, setDraft] = usePaneState("draft", saved);
  const save = () => {
    saveNote(params.id, draft);
    setSaved(draft);
  };
  const dirty = draft !== saved;

  // Work the person would lose: closing the pane, or showing another note in it, asks first.
  useUnsaved(dirty && "an unsaved edit to this note");

  // What this pane adds to ⌘K while it is focused. `keys` is a label: the content handles the key itself.
  useCommands([
    {
      id: "save",
      title: "Save note",
      keys: keyHint("Mod+Enter"),
      disabled: dirty ? false : "Nothing to save",
      run: save,
    },
  ]);

  return (
    <textarea
      aria-label="Note"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault(); // claimed
          save();
        }
      }}
    />
  );
}

export const noteEditor = definePane("note", {
  params: noteParams,
  title: ({ id }) => `Note ${id}`,
  width: { min: 280 },
  Component: NoteEditor,
});
