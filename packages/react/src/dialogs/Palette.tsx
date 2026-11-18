import { formatChord, commandsOf, runCommand } from "@jali/core/adapter";
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

/** One row: a workspace command, or a command the focused pane added (useCommands). */
interface Item {
  key: string;
  title: string;
  group: string;
  keys: string;
  disabled: boolean;
  run: () => void;
  id?: string;
}

function PaletteDialog() {
  const store = useStore();
  useUi((s) => s.view);
  const focused = useUi((s) => s.view.focused);
  const own = useUi((s) => (focused ? s.paneCommands[focused] : undefined));
  const m = useModel();
  const close = () => store.actions.closePalette();
  const x = store.snapshot();
  // The focused pane's commands come first: they are about what the person is looking at.
  const items: Item[] = [
    ...(own ?? []).map((c): Item => ({
      key: `pane:${c.id}`,
      title: c.title,
      group: m.title(focused),
      keys: c.keys ?? "",
      disabled: !!c.disabled,
      run: c.run,
    })),
    ...commandsOf(store).map((c): Item => ({
      key: c.id,
      id: c.id,
      title: c.title,
      group: c.group,
      disabled: !!c.check?.(x),
      run: () => runCommand(store, c.id),
      // Esc closes a peek through the Esc ladder, not the keymap.
      keys:
        store.keymap.label(c.id) ||
        (c.id === "peek.close" ? formatChord({ key: "Escape" }, store.keymap.platform) : ""),
    })),
  ];
  return (
    <ListDialog<Item>
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
