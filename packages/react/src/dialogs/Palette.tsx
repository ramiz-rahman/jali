import { listCommands, type ListedCommand } from "@jali/core/adapter";
import { useModel, useStore, useUi } from "../state/react";
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
  // Re-read on every change: the list depends on focus, the layout and what each pane reports.
  useUi((s) => s);
  useModel();
  const close = () => store.actions.closePalette();
  const items = listCommands(store.jali);
  return (
    <ListDialog<ListedCommand>
      className=""
      label="Commands"
      placeholder="Type a command…"
      idPrefix={`${store.dom.id}-cmd-`}
      listId={`${store.dom.id}-palette-list`}
      listLabel="Commands"
      items={items}
      keyOf={(c) => c.key}
      matches={(c, t) =>
        c.title.toLowerCase().includes(t) || c.key.includes(t) || c.group.toLowerCase().includes(t)
      }
      itemClass="jali-palette-item"
      itemProps={(c) => ({ "data-command-id": c.id ?? c.key })}
      disabled={(c) => c.disabled}
      render={(c) => (
        <>
          <span className="palette-title">{c.title}</span>
          <span className="jali-palette-group">{c.group}</span>
          {c.keys ? <kbd>{c.keys}</kbd> : <span />}
        </>
      )}
      onChoose={(c) => {
        close();
        // After the dialog unmounts and focus is back, so focus-dependent commands act on the pane.
        setTimeout(c.run, 0);
      }}
      onClose={close}
      empty={(q) => <>No command matches “{q}”.</>}
    />
  );
}
