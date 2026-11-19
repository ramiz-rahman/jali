/**
 * One segment in detail: its own waveform, play and loop, who says it, and a note. It follows the transcript's
 * selection. Click Following in its header to make it Kept, select another segment, then open that one's detail: two
 * segments side by side, to compare a take or a correction.
 *
 * The note is the pane's work: a draft in pane state until saved, reported with `useUnsaved`. While it has one, the
 * detail stays on its segment when the transcript moves on, and Jali says why.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { PauseIcon, PlayIcon, WaveformIcon } from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import {
  definePane,
  useCommands,
  usePaneState,
  useTitle,
  useUnsaved,
  type PaneProps,
} from "@jali/react";
import { cue } from "../actions";
import { useFrame, useTransport } from "../audio/react";
import { useSessionView, type SessionView } from "../edits";
import { useServices } from "../services";
import {
  clockTenths,
  segmentById,
  sessionById,
  trackById,
  trackOf,
  type SegmentData,
} from "../sessions/sessions";
import { catalogueOf } from "../sessions/catalog";
import { Missing, NotInTransport } from "../ui/parts";
import { drawBars, loudest, screenPaletteOf, prepare, useSize, voicePeaks } from "../ui/waveform";

const clipParams = { session: String, segment: String };

function Clip(props: PaneProps<typeof clipParams>) {
  const { edits } = useServices();
  const view = useSessionView(edits, props.params.session);
  const seg = segmentById(view?.session, props.params.segment);
  if (!view || !seg) return <Missing what="segment" openHere={props.openHere} />;
  return <ClipBody {...props} view={view} seg={seg} />;
}

function ClipBody({
  paused,
  inPeek,
  view,
  seg,
}: PaneProps<typeof clipParams> & { view: SessionView; seg: SegmentData }) {
  const { engine, edits } = useServices();
  const { session } = view;
  const n = session.segments.indexOf(seg) + 1;
  // "Segment 8", or "Line 8" in a song's lyrics.
  const word = catalogueOf(session).words.segment;
  const Word = word[0]!.toUpperCase() + word.slice(1);
  const speaker = view.speakerOf(seg);
  const inTransport = useTransport((s) => s.session === session.id);
  const playing = useTransport((s) => s.playing && s.session === session.id);
  const loop = useTransport((s) => s.loop);
  const looping = inTransport && loop?.segment === seg.id;
  const saved = view.edits.notes[seg.id] ?? "";
  const [note, setNote] = usePaneState<string | null>("note", null);
  const text = view.textOf(seg);
  const dirty = note !== null && note !== saved;
  const noteId = useId();

  useTitle(`${Word} ${n} · ${view.speakerName(speaker)}`);
  useUnsaved(dirty && `an unsaved note on ${word} ${n}`);

  const play = () => {
    if (playing && engine.position() >= seg.start && engine.position() < seg.end)
      return engine.pause();
    cue(engine, session.id, seg.start, true);
  };
  const toggleLoop = () => {
    if (looping) return engine.setLoop(null);
    cue(engine, session.id, seg.start);
    engine.setLoop({ start: seg.start, end: seg.end, segment: seg.id });
  };
  const saveNote = () => {
    edits.saveNote(session.id, seg.id, note ?? saved);
    setNote(null);
  };

  useCommands([
    { id: "play", title: `Play ${word} ${n}`, run: play },
    { id: "loop", title: looping ? "Stop looping" : `Loop ${word} ${n}`, run: toggleLoop },
    {
      id: "save-note",
      title: "Save the note",
      keys: keyHint("Mod+S"),
      disabled: dirty ? false : "No unsaved note",
      run: saveNote,
    },
  ]);

  const duration = seg.end - seg.start;
  const words = view.wordsOf(seg).length;
  return (
    <div className="pane-body clip">
      <header className="clip-head">
        <span className="pane-label">
          {Word} {String(n).padStart(2, "0")} of {session.segments.length}
        </span>
        <span className="clip-range mono">
          {clockTenths(seg.start)} – {clockTenths(seg.end)}
        </span>
      </header>
      {!inTransport && !inPeek ? <NotInTransport session={session.id} /> : null}
      <MiniWave seg={seg} view={view} paused={paused} />
      {/* The keys and the speaker/track LCD on one row when there is room; stacked when narrow. */}
      <div className="clip-row">
        <div className="clip-controls">
          <span className="keyset">
            <button
              type="button"
              className="key key-square key-play"
              aria-label={playing ? "Pause" : `Play ${word} ${n}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={play}
            >
              {playing ? (
                <PauseIcon size={16} weight="fill" aria-hidden />
              ) : (
                <PlayIcon size={16} weight="fill" aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="key key-latch"
              aria-pressed={looping}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleLoop}
            >
              <span className="led" aria-hidden />
              loop
            </button>
          </span>
          <span className="clip-stats" hidden>
            {duration.toFixed(1)} s · {words} words
          </span>
        </div>
        <dl className="clip-fields">
          <div>
            <dt>Speaker</dt>
            <dd>
              <select
                aria-label={`Who says this ${word}`}
                value={speaker}
                onChange={(e) => edits.setSegmentSpeaker(session.id, seg.id, e.target.value)}
              >
                {session.speakers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {view.speakerName(p.id)}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div>
            <dt>Track</dt>
            <dd>{trackById(session, trackOf(seg))?.label}</dd>
          </div>
        </dl>
      </div>
      <blockquote className="clip-text" data-corrected={text !== seg.text ? "" : undefined}>
        {text}
        {text !== seg.text ? <footer>Corrected. Recorded as: “{seg.text}”</footer> : null}
      </blockquote>
      <div className="clip-note">
        <label className="pane-label" htmlFor={noteId}>
          Note
        </label>
        {/* One recess: the page, and under it a row with the state and the two keys. */}
        <div className="pocket notepad" data-dirty={dirty ? "" : undefined}>
          <textarea
            id={noteId}
            value={note ?? saved}
            placeholder="A note for the edit: a retake, a cut, a fact to check."
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e: KeyboardEvent) => {
              if ((e.key === "s" || e.key === "Enter") && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (dirty) saveNote();
              }
            }}
          />
          <div className="notepad-keys">
            <span className="notepad-state" role="status">
              <span className="led" data-on={dirty ? "" : undefined} aria-hidden />
              {dirty ? "Not saved" : saved ? "Saved" : "No note"}
            </span>
            <button type="button" className="key" disabled={!dirty} onClick={() => setNote(null)}>
              Revert
            </button>
            <button type="button" className="key key-accent" disabled={!dirty} onClick={saveNote}>
              Save note <kbd aria-hidden>⌘S</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The segment's own waveform, a little either side of it, with the playhead when it is inside. Click to seek. */
function MiniWave({ seg, view, paused }: { seg: SegmentData; view: SessionView; paused: boolean }) {
  const { engine } = useServices();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  const [hover, setHover] = useState<number | null>(null);
  const track = trackOf(seg);
  const peaks = voicePeaks(view.session, track);
  const from = Math.max(0, seg.start - 0.4);
  const to = Math.min(view.session.duration, seg.end + 0.4);
  const inTransport = useTransport((s) => s.session === view.session.id);
  const looping = useTransport((s) => s.session === view.session.id && s.loop?.segment === seg.id);
  const scale = 1 / loudest(peaks);
  const timeAt = (x: number) => from + (x / Math.max(1, width)) * (to - from);

  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g) return;
      const c = screenPaletteOf(canvas.current!);
      const x = (t: number) => ((t - from) / (to - from)) * width;
      // One clean glass: no fill. The segment's range is marked with lines: an in and an out line with flags at the
      // top, and a fine baseline between them. State lives in the bars: the context outside the segment dim, the
      // segment's own bars bright, the played part orange. A loop over the segment is a second bracket at the foot.
      const x0 = Math.round(x(seg.start));
      const x1 = Math.round(x(seg.end));
      const playhead = inTransport && pos >= from && pos <= to ? pos : -1;
      drawBars(
        g,
        peaks,
        { x: 0, y: 12, w: width, h: height - 24 },
        { from, to },
        { idle: c.scrMusic, marked: c.scrBright, played: c.played, bar: 3, gap: 2 },
        playhead,
        { from: seg.start, to: seg.end },
        scale,
      );
      g.fillStyle = c.scrDim;
      g.fillRect(x0, 0, 1, height);
      g.fillRect(x1, 0, 1, height);
      g.fillRect(x0, 0, 7, 2);
      g.fillRect(x1 - 6, 0, 7, 2);
      g.fillStyle = c.scrLine;
      g.fillRect(x0, Math.round(height / 2), x1 - x0, 1);
      if (looping) {
        g.fillStyle = c.played;
        g.fillRect(x0, height - 2, x1 - x0 + 1, 2);
        g.fillRect(x0, height - 7, 2, 7);
        g.fillRect(x1 - 1, height - 7, 2, 7);
      }
      if (playhead >= 0) {
        const px = Math.round(x(pos));
        g.fillStyle = c.played;
        g.fillRect(px - 1, 3, 2, height - 3);
        g.fillRect(px - 4, 0, 8, 3);
      }
      if (hover !== null) {
        g.fillStyle = c.scrDim;
        g.fillRect(Math.round(hover), 0, 1, height);
      }
    },
    [width, height, seg, hover, inTransport, looping],
  );

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    cue(engine, view.session.id, timeAt(e.clientX - r.left), engine.get().playing);
  };
  return (
    <div
      ref={box}
      className="clip-wave screen"
      role="img"
      aria-label={`Waveform of the segment, ${(seg.end - seg.start).toFixed(1)} seconds. Click to play from a point.`}
      onPointerDown={seek}
      onPointerMove={(e) => setHover(e.clientX - e.currentTarget.getBoundingClientRect().left)}
      onPointerLeave={() => setHover(null)}
    >
      <canvas ref={canvas} />
    </div>
  );
}

export const clip = definePane("clip", {
  params: clipParams,
  title: ({ session, segment }) => {
    const s = sessionById(session);
    const n = s ? s.segments.findIndex((x) => x.id === segment) + 1 : 0;
    const Word = s?.id && catalogueOf(s).words.segment === "line" ? "Line" : "Segment";
    return n ? `${Word} ${n}` : Word;
  },
  icon: WaveformIcon,
  width: { min: 300, comfortable: 380, max: 560 },
  height: { min: 280 },
  Component: Clip,
});
