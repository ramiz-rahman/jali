/**
 * The library: the sessions, as cartridges (Cartridge.tsx). J/K and the arrows move the cursor, and the transcript,
 * timeline, mixer and markers that follow it show that session; the transport loads it. Enter opens its transcript.
 * Space is the transport's (play and pause), so the peek moved to Shift+Space.
 *
 * After a layout opens, the library comes back to the transport's session (workspace/followTransport.ts).
 */
import { BooksIcon } from "@phosphor-icons/react";
import type { Jali, NodeId } from "jali";
import { definePane, useJali, type PaneProps } from "jali/react";
import type { Engine } from "../../audio/engine";
import { useTransport } from "../../audio/react";
import { useServices } from "../../services";
import { catalogueOf } from "../../sessions/catalog";
import { FIRST_SESSION, SESSION_IDS, type SessionId } from "../../sessions/ids";
import { useListbox } from "../../ui/lib/listbox";
import { usePaneActions } from "../actions";
import { libraryOf, openFollowing } from "../links";
import { mixer } from "../mixer";
import { LIBRARY_KIND, sessionOf } from "../refs";
import { transcript } from "../transcript";
import { useSelectionCursor } from "../useSelectionCursor";
import { Cartridge } from "./Cartridge";

/**
 * Work on `session`: the library selects it, so the panes that follow it show it, and the transport loads it. The one
 * way the session being worked on changes: from the library's keys, ⌘K "Open session…" and a layout opening.
 */
export function workOn(
  jali: Jali,
  engine: Engine,
  session: SessionId,
  list: NodeId | undefined = libraryOf(jali)?.id,
) {
  if (list) jali.actions.select(list, transcript({ session }));
  engine.load(session);
}

function Library({ node, focused, paused, peek }: PaneProps) {
  const { engine } = useServices();
  const jali = useJali();
  const inTransport = useTransport((s) => s.session);
  const playing = useTransport((s) => s.playing);
  const { at, current, moveTo } = useSelectionCursor({
    node,
    ids: SESSION_IDS,
    idOf: sessionOf,
    choose: (id) => workOn(jali, engine, id, node.id),
    fallback: () => FIRST_SESSION,
  });

  const open = (id: SessionId) => {
    if (id !== current) moveTo(id);
    openFollowing(jali, node.id, transcript({ session: id }));
  };

  const nothing = current ? false : "Nothing selected";
  const onActionKey = usePaneActions([
    {
      id: "open",
      title: current ? `Open the transcript of “${catalogueOf(current).title}”` : "Open transcript",
      keys: [{ key: "Enter" }],
      disabled: nothing,
      run: () => current && open(current),
    },
    {
      id: "mixer",
      title: "Open the mixer for this session",
      disabled: nothing,
      run: () => current && openFollowing(jali, node.id, mixer({ session: current })),
    },
    {
      id: "peek",
      title: "Peek",
      keyOnly: true,
      keys: [{ key: " ", shift: true }],
      disabled: nothing,
      run: () => current && peek(transcript({ session: current })),
    },
  ]);
  const list = useListbox({
    id: node.id,
    count: SESSION_IDS.length,
    at,
    focused,
    onMove: (i) => moveTo(SESSION_IDS[i]!),
    onKey: onActionKey,
  });

  return (
    <div className="pane-body library">
      <div className="pane-label">
        <span>Sessions</span>
        <span className="pane-label-count">{SESSION_IDS.length}</span>
      </div>
      <div {...list.props} className="lib-rows" aria-label="Sessions">
        {SESSION_IDS.map((s, i) => (
          <Cartridge
            key={s}
            row={list.row(i)}
            session={s}
            inTransport={s === inTransport}
            live={s === inTransport && playing}
            paused={paused}
            onSelect={() => (i === at ? open(s) : moveTo(s))}
          />
        ))}
      </div>
    </div>
  );
}

export const library = definePane(LIBRARY_KIND, {
  title: "Library",
  icon: BooksIcon,
  width: { min: 240, comfortable: 280, max: 340 },
  height: { min: 220 },
  // A list has nothing to show on the whole screen; one button fewer in a narrow header.
  allow: { fullScreen: false },
  Component: Library,
});
