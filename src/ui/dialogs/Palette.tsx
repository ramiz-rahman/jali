import { formatChord } from "../commands/format";
import { COMMANDS, runCommand, type Command } from "../commands/registry";
import { useStore, useUi } from "../state/react";
import { ListDialog } from "./ListDialog";

/**
 * ⌘K: every workspace command. People see title, group and shortcut; the stable id lives in data-command-id. While it
 * has just opened, a second ⌘ chord runs a command straight away (⌘K ⌘M); the listed shortcuts teach those chords.
 */
export function Palette() {
  const open = useUi((s) => s.paletteOpen);
  return open ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const store = useStore();
  useUi((s) => s.view);
  const close = () => store.set({ paletteOpen: false });
  return (
    <ListDialog<Command>
      className=""
      label="Commands"
      placeholder="Type a command…"
      idPrefix="cmd-"
      listId="palette-list"
      listLabel="Commands"
      items={COMMANDS}
      keyOf={(c) => c.id}
      matches={(c, t) => c.title.toLowerCase().includes(t) || c.id.includes(t) || c.group.toLowerCase().includes(t)}
      itemClass="palette-item"
      itemProps={(c) => ({ "data-command-id": c.id })}
      disabled={(c) => !!c.check?.(store.snapshot())}
      render={(c) => {
        // Esc closes a peek through the Esc ladder, not the keymap.
        const keys = store.keymap.label(c.id) || (c.id === "peek.close" ? formatChord({ key: "Escape" }, store.keymap.platform) : "");
        return (
          <>
            <span className="palette-title">{c.title}</span>
            <span className="palette-group">{c.group}</span>
            {keys ? <kbd>{keys}</kbd> : <span />}
          </>
        );
      }}
      onChoose={(c) => {
        close();
        // After the dialog unmounts and focus is back, so focus-dependent commands act on the pane.
        setTimeout(() => runCommand(store, c.id), 0);
      }}
      onClose={close}
      empty={(q) => <>No command matches “{q}”.</>}
    />
  );
}
