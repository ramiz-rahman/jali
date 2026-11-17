import { COMMANDS, runCommand, shortcutLabel, type Command } from "../commands/registry";
import { useStore, useUi } from "../state/react";
import { ListDialog } from "./ListDialog";

/** ⌘K: every workspace command. People see title, group and shortcut; the stable id lives in data-command-id. */
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
        const keys = shortcutLabel(c.id);
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
