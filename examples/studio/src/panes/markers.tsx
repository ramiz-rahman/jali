/**
 * Timed markers: a list that seeks. The marker the playhead has passed last is lit. M adds one at the playhead,
 * Enter goes to the selected one, R renames it (F2 is Jali's, for tabs), Delete removes it.
 */
import { useState } from "react";
import { BookmarkSimpleIcon, PencilSimpleIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { usePaneState } from "jali-layout/react";
import { usePosition } from "../audio/react";
import { markerIndexAt } from "../model/markers";
import { useServices } from "../services";
import { clock } from "../sessions/format";
import { stringOrNull } from "../storage";
import { useListbox } from "../ui/lib/listbox";
import { InlineField } from "../ui/molecules/InlineField";
import { StatusDisplay } from "../ui/molecules/StatusDisplay";
import { ActionKey, usePaneActions, type PaneAction } from "./actions";
import { defineSessionPane, type SessionPaneProps } from "./sessionPane";

function Markers({ paused, node, focused, view, transport }: SessionPaneProps) {
  const { engine, notify } = useServices();
  const { session, markers } = view;
  const { inTransport, playing } = transport;
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null, { parse: stringOrNull });
  const [renaming, setRenaming] = useState<string | null>(null);
  const pos = usePosition(paused || !inTransport, 0.1);
  const at = markers.findIndex((m) => m.id === cursor);
  const current = markers[at];
  const passed = inTransport ? markerIndexAt(markers, pos) : -1;
  const playhead = inTransport ? pos : 0;

  const go = (i: number) => {
    const m = markers[i];
    if (!m) return;
    setCursor(m.id);
    engine.cue(session.id, m.time, playing);
  };
  const add = () => {
    const t = inTransport ? engine.position() : 0;
    const m = view.edit.addMarker(t, `Marker at ${clock(t)}`);
    setCursor(m.id);
    setRenaming(m.id);
  };
  const remove = (id: string) => {
    const gone = markers.find((m) => m.id === id);
    const next = markers[at + 1] ?? markers[at - 1];
    view.edit.removeMarker(id);
    if (id === cursor) setCursor(next?.id ?? null);
    // A delete is one key: it can be taken back.
    if (gone) notify(`Deleted “${gone.label}”`, { undo: () => view.edit.restoreMarker(gone) });
  };
  const nothing = current ? false : "Nothing selected";

  const actions = {
    add: {
      id: "add",
      title: "Add a marker at the playhead",
      keys: [{ key: "m" }],
      run: add,
      face: (
        <>
          <PlusIcon size={13} aria-hidden /> at {clock(playhead)}
        </>
      ),
    },
    go: {
      id: "go",
      title: current ? `Go to “${current.label}”` : "Go to marker",
      keys: [{ key: "Enter" }],
      disabled: nothing,
      run: () => go(at),
    },
    rename: {
      id: "rename",
      title: "Rename the selected marker",
      keys: [{ key: "r" }],
      disabled: nothing,
      run: () => current && setRenaming(current.id),
      face: <PencilSimpleIcon size={13} aria-hidden />,
    },
    remove: {
      id: "remove",
      title: "Delete the selected marker",
      keys: [{ key: "Delete" }, { key: "Backspace" }],
      disabled: nothing,
      run: () => current && remove(current.id),
      face: <XIcon size={13} aria-hidden />,
    },
    restore: {
      id: "restore",
      title: "Restore the session's own markers",
      disabled: view.edits.markers ? false : "They are as the session came",
      run: () => view.edit.resetMarkers(),
    },
  } satisfies Record<string, PaneAction>;
  const onActionKey = usePaneActions(Object.values(actions));
  const list = useListbox({
    id: node.id,
    count: markers.length,
    at,
    focused,
    onMove: (i) => setCursor(markers[i]!.id),
    onKey: onActionKey,
  });

  return (
    <div className="pane-body markers">
      <div className="toolbar">
        <span className="pane-label">
          Markers <span className="pane-label-count">{markers.length}</span>
        </span>
        <span className="toolbar-end keyset">
          <ActionKey action={actions.add} className="key-s" />
          <ActionKey
            action={actions.rename}
            className="key-s key-square"
            aria-label={actions.rename.title}
          />
          <ActionKey
            action={actions.remove}
            className="key-s key-square"
            aria-label={current ? `Delete “${current.label}”` : "Delete marker"}
          />
        </span>
      </div>
      {markers.length ? (
        <div {...list.props} className="mk-rows lcd" aria-label="Markers">
          {markers.map((m, i) => (
            <div
              key={m.id}
              {...list.row(i)}
              data-passed={i === passed ? "" : undefined}
              className="mk-row"
              onClick={() => go(i)}
              onDoubleClick={() => setRenaming(m.id)}
            >
              <span className="mk-time mono">{clock(m.time)}</span>
              {renaming === m.id ? (
                <InlineField
                  className="mk-field"
                  label="Marker's name"
                  value={m.label}
                  onDone={(label) => {
                    if (label?.trim()) view.edit.renameMarker(m.id, label.trim());
                    setRenaming(null);
                    list.ref.current?.focus();
                  }}
                />
              ) : (
                <span className="mk-label">{m.label}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <StatusDisplay
          title="No markers yet"
          action={{ label: `add one at ${clock(playhead)}`, run: add }}
        >
          Press M anywhere in this pane to mark the playhead.
        </StatusDisplay>
      )}
    </div>
  );
}

export const markers = defineSessionPane("markers", {
  name: "Markers",
  icon: BookmarkSimpleIcon,
  width: { min: 240, comfortable: 290, max: 400 },
  height: { min: 170 },
  allow: { fullScreen: false },
  Body: Markers,
});
