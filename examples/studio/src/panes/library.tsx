/**
 * The library: the sessions. J/K and the arrows move the cursor, and the transcript, timeline, mixer and markers that
 * follow it show that session; the transport loads it. Enter opens its transcript. Space is the transport's (play and
 * pause), so the peek moved to Shift+Space.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { BooksIcon } from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "@jali/react";
import { openFollowing } from "../actions";
import { useFrame, useTransport } from "../audio/react";
import { useSessionView } from "../edits";
import { useServices } from "../services";
import { catalogueOf } from "../sessions/catalog";
import { clock, SESSIONS, spokenDuration, type SessionData } from "../sessions/sessions";
import {
  drawBars,
  loudest,
  overviewPeaks,
  screenPaletteOf,
  prepare,
  useSize,
} from "../ui/waveform";
import { listMove, scrollRowIntoView } from "./keys";
import { mixer } from "./mixer";
import { transcript } from "./transcript";

function Library({ node, select, focused, paused, peek }: PaneProps) {
  const { engine } = useServices();
  const jali = useJali();
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null);
  const inTransport = useTransport((s) => s.session);
  const playing = useTransport((s) => s.playing);
  const listRef = useRef<HTMLDivElement>(null);
  // The cursor is the library's selection in Jali, so a command ("Open session…") can move it too.
  const selected = useJaliState((s) => s.selection[node.id]?.ref.params.session);
  const at = SESSIONS.findIndex((s) => s.id === (typeof selected === "string" ? selected : cursor));
  const current = at >= 0 ? SESSIONS[at] : undefined;

  // Tell Jali what is selected: the panes that follow the library show it. The transport takes it at once.
  const moveTo = (id: string) => {
    setCursor(id);
    select(transcript({ session: id }));
    engine.load(id);
  };

  // On first show, start on the session the followers already show, so nothing jumps (a link, a reload).
  useEffect(() => {
    const follower = jali.model().panes.find((p) => p.linkedTo === node.id && p.follows);
    const shown = follower?.ref.params.session;
    const start =
      cursor && SESSIONS.some((s) => s.id === cursor)
        ? cursor
        : typeof shown === "string"
          ? shown
          : SESSIONS[0]!.id;
    moveTo(start);
    // Once: later moves come from the person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => scrollRowIntoView(listRef.current, at), [at]);

  const open = (id: string) => {
    if (id !== cursor) moveTo(id);
    openFollowing(jali, node.id, transcript({ session: id }));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at, SESSIONS.length);
    if (to !== null) moveTo(SESSIONS[to]!.id);
    else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && current) open(current.id);
    else if (e.key === " " && e.shiftKey && current) peek(transcript({ session: current.id }));
    else return; // not ours (Space among them): let it bubble to the workspace and the transport
    e.preventDefault();
  };

  useCommands([
    {
      id: "open",
      title: current ? `Open the transcript of “${current.title}”` : "Open transcript",
      keys: keyHint("Enter"),
      disabled: current ? false : "Nothing selected",
      run: () => current && open(current.id),
    },
    {
      id: "mixer",
      title: "Open the mixer for this session",
      disabled: current ? false : "Nothing selected",
      run: () => current && openFollowing(jali, node.id, mixer({ session: current.id })),
    },
  ]);

  return (
    <div className="pane-body library">
      <div className="pane-label">
        <span>Sessions</span>
        <span className="pane-label-count">{SESSIONS.length}</span>
      </div>
      <div
        ref={listRef}
        className="lib-rows"
        role="listbox"
        aria-label="Sessions"
        tabIndex={0}
        aria-activedescendant={current ? `${node.id}-${current.id}` : undefined}
        onKeyDown={onKeyDown}
      >
        {SESSIONS.map((s, i) => (
          <Row
            key={s.id}
            id={`${node.id}-${s.id}`}
            session={s}
            selected={i === at}
            active={focused && i === at}
            live={s.id === inTransport && playing}
            inTransport={s.id === inTransport}
            paused={paused}
            onSelect={() => (i === at ? open(s.id) : moveTo(s.id))}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  id,
  session,
  selected,
  active,
  live,
  inTransport,
  paused,
  onSelect,
}: {
  id: string;
  session: SessionData;
  selected: boolean;
  active: boolean;
  live: boolean;
  inTransport: boolean;
  paused: boolean;
  onSelect: () => void;
}) {
  const { edits } = useServices();
  const view = useSessionView(edits, session.id);
  const corrected = Object.keys(view?.edits.corrections ?? {}).length;
  const notes = Object.keys(view?.edits.notes ?? {}).length;
  const cat = catalogueOf(session);
  const tracks = `${session.tracks.length} tracks`;
  return (
    <div
      id={id}
      data-row=""
      role="option"
      aria-selected={selected}
      data-active={active ? "" : undefined}
      data-live={live ? "" : undefined}
      className="lib-row"
      onClick={onSelect}
      // Named by what it shows (WCAG 2.5.3: the name contains the visible words); the running time spoken in full.
      aria-description={spokenDuration(session.duration)}
    >
      {/* A cartridge: a paper label with the source and the title, a lamp; a window onto the tape (every track's
          loudest at each moment); the running time, the track count and the licence printed on its foot. */}
      <span className="lib-lamp" aria-hidden />
      <div className="lib-label">
        <span className="lib-show">{cat.source}</span>
        <b className="lib-title">{session.title}</b>
      </div>
      <Thumbnail session={session} paused={paused} inTransport={inTransport} />
      <div className="lib-meta">
        <span className="mono">{clock(session.duration)}</span>
        <span className="dot" aria-hidden />
        <span>{tracks}</span>
        <span className="dot" aria-hidden />
        <span className="lib-licence" title={cat.licence.name}>
          {cat.licence.short}
        </span>
      </div>
      {live ? <span className="lib-live">playing</span> : null}
      {corrected || notes ? (
        <div className="lib-tags">
          {corrected ? <span className="tag">{corrected} corrected</span> : null}
          {notes ? (
            <span className="tag">
              {notes} {notes === 1 ? "note" : "notes"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The session's speech as a strip of bars; the session in the transport shows how far it has played. */
function Thumbnail({
  session,
  paused,
  inTransport,
}: {
  session: SessionData;
  paused: boolean;
  inTransport: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  const peaks = overviewPeaks(session);
  const scale = 1 / loudest(peaks);
  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g) return;
      const c = screenPaletteOf(canvas.current!);
      drawBars(
        g,
        peaks,
        { x: 0, y: 0, w: width, h: height },
        { from: 0, to: session.duration },
        { idle: c.idle, played: c.played, bar: 2, gap: 1 },
        inTransport ? pos : -1,
        null,
        scale,
      );
    },
    [width, height, inTransport, session],
  );
  return (
    <div ref={box} className="lib-wave screen" aria-hidden>
      <canvas ref={canvas} />
    </div>
  );
}

export const library = definePane("library", {
  title: "Library",
  icon: BooksIcon,
  width: { min: 240, comfortable: 280, max: 340 },
  height: { min: 220 },
  // A list has nothing to show on the whole screen; one button fewer in a narrow header.
  allow: { fullScreen: false },
  Component: Library,
});
