/**
 * One segment in detail: its own waveform, play and loop, who says it, and a note. It follows the transcript's
 * selection. Keep it (the anchor in its header) and select another segment, then open that one's detail: two
 * segments side by side, to compare a take or a correction.
 *
 * The note is the pane's work: a draft in pane state until saved, reported with `useUnsaved`. While it has one, the
 * detail stays on its segment when the transcript moves on, and Jali says why.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { PauseIcon, PlayIcon, RepeatIcon, WaveformIcon } from "@phosphor-icons/react";
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
  trackOf,
  TRACKS,
  type SegmentData,
} from "../sessions/sessions";
import { Empty, NotInTransport } from "../ui/parts";
import { drawBars, loudest, paletteOf, prepare, useSize, voicePeaks } from "../ui/waveform";

const clipParams = { session: String, segment: String };

function Clip(props: PaneProps<typeof clipParams>) {
  const { edits } = useServices();
  const view = useSessionView(edits, props.params.session);
  const seg = segmentById(view?.session, props.params.segment);
  if (!view || !seg) return <Empty title="No such segment" />;
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
  const speaker = view.speakerOf(seg);
  const inTransport = useTransport((s) => s.session === session.id);
  const playing = useTransport((s) => s.playing && s.session === session.id);
  const loop = useTransport((s) => s.loop);
  const looping = inTransport && loop?.segment === seg.id;
  const saved = view.edits.notes[seg.id] ?? "";
  const [note, setNote] = usePaneState<string | null>("note", null);
  const text = view.textOf(seg);
  const dirty = note !== null && note !== saved;

  useTitle(`Segment ${n} · ${view.speakerName(speaker)}`);
  useUnsaved(dirty && `an unsaved note on segment ${n}`);

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
    { id: "play", title: `Play segment ${n}`, run: play },
    { id: "loop", title: looping ? "Stop looping" : `Loop segment ${n}`, run: toggleLoop },
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
          Segment {String(n).padStart(2, "0")} of {session.segments.length}
        </span>
        <span className="clip-range mono">
          {clockTenths(seg.start)} – {clockTenths(seg.end)}
        </span>
      </header>
      {!inTransport && !inPeek ? <NotInTransport session={session.id} /> : null}
      <MiniWave seg={seg} view={view} paused={paused || !inTransport} />
      <div className="clip-controls">
        <button
          type="button"
          className="play-btn play-btn-small"
          aria-label={playing ? "Pause" : `Play segment ${n}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={play}
        >
          {playing ? (
            <PauseIcon size={14} weight="fill" aria-hidden />
          ) : (
            <PlayIcon size={14} weight="fill" aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="chip-toggle"
          aria-pressed={looping}
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleLoop}
        >
          <RepeatIcon size={14} aria-hidden /> Loop
        </button>
        <span className="clip-stats mono">
          {duration.toFixed(1)} s · {words} words
        </span>
      </div>
      <dl className="clip-fields">
        <div>
          <dt>Speaker</dt>
          <dd>
            <select
              aria-label="Who says this segment"
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
          <dd>{TRACKS.find((t) => t.id === trackOf(seg))?.label}</dd>
        </div>
      </dl>
      <blockquote className="clip-text" data-corrected={text !== seg.text ? "" : undefined}>
        {text}
        {text !== seg.text ? <footer>Corrected. Recorded as: “{seg.text}”</footer> : null}
      </blockquote>
      <label className="clip-note">
        <span className="pane-label">Note</span>
        <textarea
          value={note ?? saved}
          placeholder="A note for the edit: a retake, a cut, a fact to check."
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (dirty) saveNote();
            }
          }}
        />
      </label>
      <div className="clip-note-foot">
        {dirty ? (
          <span className="unsaved-note">Not saved</span>
        ) : saved ? (
          <span className="toolbar-note">Saved</span>
        ) : null}
        <button
          type="button"
          className="btn btn-quiet"
          disabled={!dirty}
          onClick={() => setNote(null)}
        >
          Revert
        </button>
        <button type="button" className="btn btn-signal" disabled={!dirty} onClick={saveNote}>
          Save note
        </button>
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
  const scale = 1 / loudest(peaks);
  const timeAt = (x: number) => from + (x / Math.max(1, width)) * (to - from);

  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g) return;
      const c = paletteOf(canvas.current!);
      const x = (t: number) => ((t - from) / (to - from)) * width;
      // The segment's own span, behind the bars.
      g.fillStyle = c.signalSoft;
      g.fillRect(x(seg.start), 0, x(seg.end) - x(seg.start), height);
      drawBars(
        g,
        peaks,
        { x: 0, y: 6, w: width, h: height - 12 },
        { from, to },
        { idle: c.idle, played: c.played, bar: 3, gap: 2 },
        inTransport && pos >= from && pos <= to ? pos : -1,
        null,
        scale,
      );
      if (inTransport && pos >= from && pos <= to) {
        g.fillStyle = c.played;
        g.fillRect(Math.round(x(pos)) - 1, 0, 2, height);
      }
      if (hover !== null) {
        g.fillStyle = c.signalSoft;
        g.fillRect(Math.round(hover), 0, 1, height);
      }
    },
    [width, height, seg, hover, inTransport],
  );

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    cue(engine, view.session.id, timeAt(e.clientX - r.left), engine.get().playing);
  };
  return (
    <div
      ref={box}
      className="clip-wave"
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
    return n ? `Segment ${n}` : "Segment";
  },
  icon: WaveformIcon,
  width: { min: 300, comfortable: 380, max: 560 },
  height: { min: 280 },
  Component: Clip,
});
