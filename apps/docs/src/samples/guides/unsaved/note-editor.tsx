import { keyHint } from "jali";
import { definePane, useCommands, usePaneState, useUnsaved, type PaneProps } from "jali/react";
import { NotePencilIcon } from "@phosphor-icons/react";

// Your own save, for example a fetch to your API.
declare function saveNote(ticketId: number, text: string): Promise<void>;

// The params, declared first so the component can be typed from them.
const noteParams = { id: Number };

/** A note on a ticket. The draft outlives folds, tabs and reloads; closing with an unsaved edit asks first. */
function TicketNote({ params }: PaneProps<typeof noteParams>) {
  // Kept by Jali for this pane. JSON values only.
  const [draft, setDraft] = usePaneState("draft", "");
  const [saved, setSaved] = usePaneState("saved", "");
  const edited = draft !== saved;

  const save = async () => {
    await saveNote(params.id, draft);
    setSaved(draft);
  };

  // Unsaved work while the draft differs from what was saved. It clears itself when the pane goes.
  useUnsaved(edited && "an unsaved note");

  // Commands for ⌘K while this pane is focused. Each run calls the latest `save`.
  useCommands([
    {
      id: "save",
      title: "Save note",
      keys: keyHint("Mod+S"), // a label only: the textarea below handles the key itself
      disabled: edited ? false : "Nothing to save",
      run: () => void save(),
    },
  ]);

  return (
    <textarea
      aria-label={`Note on ticket ${params.id}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault(); // claimed: Jali leaves this key alone
          void save();
        }
      }}
    />
  );
}

export const ticketNote = definePane("ticket-note", {
  params: noteParams,
  title: ({ id }) => `Note on ticket ${id}`,
  icon: NotePencilIcon,
  width: { min: 320 },
  height: { min: 200 },
  Component: TicketNote,
});
