import { useEffect, useRef, useState } from "react";
import { keyHint } from "@jali/core";
import { definePaneKind, usePaneState, type PaneComponentProps } from "@jali/react";
import { noteBody, saveNote } from "./data";

function NoteEditor({ ref, setUnsaved, setCommands }: PaneComponentProps) {
  const id = Number(ref.params.id);
  const [saved, setSaved] = useState(() => noteBody(id));
  // The draft is pane state: it survives a fold, a tab switch, a tuck and a reload, and goes when the pane closes.
  const [draft, setDraft] = usePaneState("draft", saved);
  const save = () => { saveNote(id, draft); setSaved(draft); };

  // Work the person would lose: closing the pane, or showing another note in it, asks first.
  const dirty = draft !== saved;
  useEffect(() => { setUnsaved(dirty ? "an unsaved edit to this note" : null); }, [dirty, setUnsaved]);

  // What this pane adds to ⌘K while it is focused. `keys` is a label: the content handles the key itself.
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => {
    setCommands([{ id: "save", title: "Save note", keys: keyHint("Mod+Enter"), disabled: dirty ? false : "Nothing to save", run: () => latest.current() }]);
  }, [setCommands, dirty]);
  useEffect(() => () => setCommands(null), [setCommands]);

  return (
    <textarea
      aria-label="Note"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } // claimed
      }}
    />
  );
}

export const noteEditor = definePaneKind({
  kind: "note",
  title: (ref) => `Note ${ref.params.id}`,
  ref: (params) => ({ kind: "note", params }),
  minWidth: 280,
  minHeight: 160,
  Component: NoteEditor,
});
