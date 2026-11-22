/**
 * The library: the sessions. J/K and the arrows move the cursor, and the transcript, timeline, mixer and markers that
 * follow it show that session; the transport loads it. Enter opens its transcript. Space is the transport's (play and
 * pause), so the peek moved to Shift+Space.
 */
import { Suspense, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { BooksIcon } from "@phosphor-icons/react";
import { keyHint } from "jali";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "jali/react";
import { openFollowing } from "../actions";
import { useFrame, useTransport } from "../audio/react";
import { useServices } from "../services";
import { useStore } from "@jali-examples/shared/store";
import { stringOrNull } from "../stored";
import { catalogueOf } from "../sessions/catalog";
import {
  clock,
  FIRST_SESSION,
  SESSION_IDS,
  spokenDuration,
  useSession,
} from "../sessions/sessions";
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
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null, { parse: stringOrNull });
  const inTransport = useTransport((s) => s.session);
  const playing = useTransport((s) => s.playing);
  const listRef = useRef<HTMLDivElement>(null);
  // The cursor is the library's selection in Jali, so a command ("Open session…") can move it too.
  const selected = useJaliState((s) => s.selection[node.id]?.ref.params.session);
  const at = SESSION_IDS.indexOf(typeof selected === "string" ? selected : (cursor ?? ""));
  const current = at >= 0 ? SESSION_IDS[at] : undefined;
  const title = current ? catalogueOf(current).title : undefined;

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
      cursor && SESSION_IDS.includes(cursor)
        ? cursor
        : typeof shown === "string"
          ? shown
          : FIRST_SESSION;
    moveTo(start);
    // Once: later moves come from the person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A layout brings its own followers, showing the session they were built or left with, and Jali settles the
  // library's selection on what they show (the layout's word wins). In Studio the session being worked on is the
  // one in the transport, so after a layout opens the library selects that one again and its followers come to it.
  const presetId = useJaliState((s) => s.presetId);
  const firstPreset = useRef(presetId);
  useEffect(() => {
    if (presetId === firstPreset.current) return;
    firstPreset.current = presetId;
    const session = engine.get().session;
    setCursor(session);
    select(transcript({ session }));
    // A layout's kept segment (Compare keeps one beside the one that follows) is a segment of the session the
    // layout was designed on. On another session it would be a dead pane, so it takes this session's first.
    const first = engine.session().segments[0];
    for (const p of jali.model().panes) {
      if (p.ref.kind !== "clip" || p.follows || p.ref.params.session === session || !first)
        continue;
      jali.actions.openHere(p.id, { kind: "clip", params: { session, segment: first.id } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  useEffect(() => scrollRowIntoView(listRef.current, at), [at]);

  const open = (id: string) => {
    if (id !== cursor) moveTo(id);
    openFollowing(jali, node.id, transcript({ session: id }));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at, SESSION_IDS.length);
    const next = to === null ? undefined : SESSION_IDS[to];
    if (next) moveTo(next);
    else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && current) open(current);
    else if (e.key === " " && e.shiftKey && current) peek(transcript({ session: current }));
    else return; // not ours (Space among them): let it bubble to the workspace and the transport
    e.preventDefault();
  };

  useCommands([
    {
      id: "open",
      title: title ? `Open the transcript of “${title}”` : "Open transcript",
      keys: keyHint("Enter"),
      disabled: current ? false : "Nothing selected",
      run: () => current && open(current),
    },
    {
      id: "mixer",
      title: "Open the mixer for this session",
      disabled: current ? false : "Nothing selected",
      run: () => current && openFollowing(jali, node.id, mixer({ session: current })),
    },
  ]);

  return (
    <div className="pane-body library">
      <div className="pane-label">
        <span>Sessions</span>
        <span className="pane-label-count">{SESSION_IDS.length}</span>
      </div>
      <div
        ref={listRef}
        className="lib-rows"
        role="listbox"
        aria-label="Sessions"
        tabIndex={0}
        aria-activedescendant={current ? `${node.id}-${current}` : undefined}
        onKeyDown={onKeyDown}
      >
        {SESSION_IDS.map((s, i) => (
          <Row
            key={s}
            id={`${node.id}-${s}`}
            session={s}
            selected={i === at}
            active={focused && i === at}
            live={s === inTransport && playing}
            inTransport={s === inTransport}
            paused={paused}
            onSelect={() => (i === at ? open(s) : moveTo(s))}
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
  session: string;
  selected: boolean;
  active: boolean;
  live: boolean;
  inTransport: boolean;
  paused: boolean;
  onSelect: () => void;
}) {
  const { edits } = useServices();
  // The card is drawn from the catalogue, so it shows before the session's data has loaded; only the tape's window
  // waits for it.
  const mine = useStore(edits, (all) => (Object.hasOwn(all, session) ? all[session] : undefined));
  const corrected = Object.keys(mine?.corrections ?? {}).length;
  const notes = Object.keys(mine?.notes ?? {}).length;
  const cat = catalogueOf(session);
  const tracks = `${cat.tracks} tracks`;
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
      aria-description={spokenDuration(cat.duration)}
    >
      {/* A cartridge: a paper label with the source and the title, a lamp; a window onto the tape (every track's
          loudest at each moment); the running time, the track count and the licence printed on its foot. */}
      <span className="lib-lamp" aria-hidden />
      <div className="lib-label">
        <span className="lib-show">{cat.source}</span>
        <b className="lib-title">{cat.title}</b>
      </div>
      <Suspense fallback={<div className="lib-wave screen" aria-hidden />}>
        <Thumbnail session={session} paused={paused} inTransport={inTransport} />
      </Suspense>
      <div className="lib-meta">
        <span className="mono">{clock(cat.duration)}</span>
        <span className="dot lib-tracks" aria-hidden />
        <span className="lib-tracks">{tracks}</span>
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
  session: id,
  paused,
  inTransport,
}: {
  session: string;
  paused: boolean;
  inTransport: boolean;
}) {
  // Suspends until the session's data has loaded; the card around it shows meanwhile (Row's Suspense).
  const session = useSession(id);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  const peaks = useMemo(() => (session ? overviewPeaks(session) : []), [session]);
  const scale = 1 / loudest(peaks);
  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g || !session) return;
      const c = screenPaletteOf();
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
