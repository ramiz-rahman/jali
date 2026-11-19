/**
 * Timed markers: a list that seeks. The marker the playhead has passed last is lit. M adds one at the playhead,
 * Enter goes to the selected one, F2-like renaming is R (F2 is Jali's, for tabs), Delete removes.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookmarkSimpleIcon, PencilSimpleIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import { definePane, useCommands, usePaneState, type PaneProps } from "@jali/react";
import { cue } from "../actions";
import { usePosition, useTransport } from "../audio/react";
import { useSessionView } from "../edits";
import { useServices } from "../services";
import { clock, markerIndexAt, sessionById } from "../sessions/sessions";
import { Empty, Missing } from "../ui/parts";
import { followSession } from "./follow";
import { listMove, scrollRowIntoView } from "./keys";

const markersParams = { session: String };

function Markers({ params, paused, node, focused, openHere }: PaneProps<typeof markersParams>) {
  const { engine, edits } = useServices();
  const view = useSessionView(edits, params.session);
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const inTransport = useTransport((s) => s.session === params.session);
  const playing = useTransport((s) => s.playing);
  const pos = usePosition(paused || !inTransport, 0.1);
  const listRef = useRef<HTMLDivElement>(null);
  const markers = view?.markers ?? [];
  const at = markers.findIndex((m) => m.id === cursor);
  const current = markers[at];
  const passed = inTransport ? markerIndexAt(markers, pos) : -1;

  useEffect(() => scrollRowIntoView(listRef.current, at), [at]);

  const go = (i: number) => {
    const m = markers[i];
    if (!m) return;
    setCursor(m.id);
    cue(engine, params.session, m.time, inTransport && playing);
  };
  const add = () => {
    const t = inTransport ? engine.position() : 0;
    const m = edits.addMarker(params.session, t, `Marker at ${clock(t)}`);
    setCursor(m.id);
    setRenaming(m.id);
  };
  const remove = (id: string) => {
    const next = markers[at + 1] ?? markers[at - 1];
    edits.removeMarker(params.session, id);
    if (id === cursor) setCursor(next?.id ?? null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    const to = listMove(e, at, markers.length);
    if (to !== null) setCursor(markers[to]!.id);
    else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && current) go(at);
    else if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey) add();
    else if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && current)
      setRenaming(current.id);
    else if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey && current)
      remove(current.id);
    else return;
    e.preventDefault();
  };

  useCommands([
    { id: "add", title: "Add a marker at the playhead", keys: "M", run: add },
    {
      id: "go",
      title: current ? `Go to “${current.label}”` : "Go to marker",
      keys: keyHint("Enter"),
      disabled: current ? false : "Nothing selected",
      run: () => go(at),
    },
    {
      id: "rename",
      title: "Rename the marker",
      keys: "R",
      disabled: current ? false : "Nothing selected",
      run: () => current && setRenaming(current.id),
    },
    {
      id: "remove",
      title: "Delete the marker",
      keys: keyHint("Delete"),
      disabled: current ? false : "Nothing selected",
      run: () => current && remove(current.id),
    },
  ]);

  if (!view) return <Missing what="session" openHere={openHere} />;
  return (
    <div className="pane-body markers">
      <div className="toolbar">
        <span className="pane-label">
          Markers <span className="pane-label-count">{markers.length}</span>
        </span>
        <span className="toolbar-end keyset">
          <button
            type="button"
            className="key key-s"
            onMouseDown={(e) => e.preventDefault()}
            onClick={add}
            title="Add a marker at the playhead (M)"
          >
            <PlusIcon size={13} aria-hidden /> at {clock(inTransport ? pos : 0)}
          </button>
          <button
            type="button"
            className="key key-s key-square"
            disabled={!current}
            aria-label="Rename the selected marker"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => current && setRenaming(current.id)}
            title="Rename the selected marker (R)"
          >
            <PencilSimpleIcon size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="key key-s key-square"
            disabled={!current}
            aria-label={current ? `Delete “${current.label}”` : "Delete marker"}
            title="Delete the selected marker (Delete)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => current && remove(current.id)}
          >
            <XIcon size={13} aria-hidden />
          </button>
        </span>
      </div>
      {markers.length ? (
        <div
          ref={listRef}
          className="mk-rows lcd"
          role="listbox"
          aria-label="Markers"
          tabIndex={0}
          aria-activedescendant={current ? `${node.id}-${current.id}` : undefined}
          onKeyDown={onKeyDown}
        >
          {markers.map((m, i) => (
            <div
              key={m.id}
              id={`${node.id}-${m.id}`}
              data-row=""
              role="option"
              aria-selected={i === at}
              data-active={focused && i === at ? "" : undefined}
              data-passed={i === passed ? "" : undefined}
              className="mk-row"
              onClick={() => go(i)}
              onDoubleClick={() => setRenaming(m.id)}
            >
              <span className="mk-time mono">{clock(m.time)}</span>
              {renaming === m.id ? (
                <MarkerField
                  label={m.label}
                  onDone={(label) => {
                    if (label?.trim()) edits.renameMarker(params.session, m.id, label.trim());
                    setRenaming(null);
                    listRef.current?.focus();
                  }}
                />
              ) : (
                <span className="mk-label">{m.label}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="No markers yet"
          action={{ label: `add one at ${clock(inTransport ? pos : 0)}`, run: add }}
        >
          Press M anywhere in this pane to mark the playhead.
        </Empty>
      )}
    </div>
  );
}

function MarkerField({ label, onDone }: { label: string; onDone(label: string | null): void }) {
  const [value, setValue] = useState(label);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      className="mk-field"
      aria-label="Marker's name"
      value={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
    />
  );
}

export const markers = definePane("markers", {
  params: markersParams,
  title: ({ session }) => `Markers · ${sessionById(session)?.title ?? session}`,
  icon: BookmarkSimpleIcon,
  width: { min: 240, comfortable: 290, max: 400 },
  height: { min: 170 },
  follow: followSession,
  allow: { fullScreen: false },
  Component: Markers,
});
