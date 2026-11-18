import { useEffect, useState } from "react";
import { definePaneKind, type PaneComponentProps } from "@jali/react";
import { FileText } from "lucide-react";

function OrderNote({ ref, paused, setUnsaved, setCommands, setActivity }: PaneComponentProps) {
  const [draft, setDraft] = useState("");
  // Unsaved work: closing or replacing this pane asks first while it is set.
  useEffect(() => setUnsaved(draft ? "a note that is not saved" : null), [draft, setUnsaved]);
  // Commands in ⌘K while the pane is focused.
  useEffect(() => {
    setCommands([{ id: "save", title: "Save note", keys: "Mod+S", disabled: draft ? false : "Nothing to save", run: () => setDraft("") }]);
    return () => setCommands(null);
  }, [draft, setCommands]);
  useEffect(() => setActivity(paused ? "idle" : "working"), [paused, setActivity]);
  return <textarea aria-label={`Note on order ${ref.params.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} />;
}

export const orderNoteKind = definePaneKind({
  kind: "order-note",
  title: (ref) => `Note on order ${ref.params.id}`,
  ref: (params) => ({ kind: "order-note", params }),
  icon: FileText,
  minWidth: 280,
  maxWidth: 640,
  minHeight: 160,
  Component: OrderNote,
});
