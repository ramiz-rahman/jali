import { useEffect, useRef } from "react";
import { keyHint } from "@jali/core";
import { definePaneKind, usePaneState, type PaneComponentProps } from "@jali/react";
import { NotebookPen } from "lucide-react";

// Your own save, for example a fetch to your API.
declare function saveNote(ticketId: number, text: string): Promise<void>;

/** A note on a ticket. The draft outlives folds, tabs and reloads; closing with an unsaved edit asks first. */
function TicketNote({ ref, setUnsaved, setCommands }: PaneComponentProps) {
  const ticketId = Number(ref.params.id);
  // Kept by the workspace for this pane. JSON values only.
  const [draft, setDraft] = usePaneState("draft", "");
  const [saved, setSaved] = usePaneState("saved", "");

  // Report unsaved work while the draft differs from what was saved. Jali clears it when the pane goes.
  const edited = draft !== saved;
  useEffect(() => { setUnsaved(edited ? "an unsaved note" : null); }, [setUnsaved, edited]);

  const save = async () => {
    await saveNote(ticketId, draft);
    setSaved(draft);
  };

  // Commands for ⌘K while this pane is focused. A ref keeps `run` calling the latest `save`.
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => {
    setCommands([
      {
        id: "save",
        title: "Save note",
        keys: keyHint("Mod+S"), // a label only: the textarea below handles the key itself
        disabled: edited ? false : "Nothing to save",
        run: () => void latest.current(),
      },
    ]);
  }, [setCommands, edited]);
  useEffect(() => () => setCommands(null), [setCommands]);

  return (
    <textarea
      aria-label={`Note on ticket ${ticketId}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault(); // claimed: the workspace leaves this key alone
          void save();
        }
      }}
    />
  );
}

export const ticketNote = definePaneKind({
  kind: "ticket-note",
  title: (ref) => `Note on ticket ${ref.params.id}`,
  ref: (params) => ({ kind: "ticket-note", params }),
  minWidth: 320,
  minHeight: 200,
  icon: NotebookPen,
  Component: TicketNote,
});
