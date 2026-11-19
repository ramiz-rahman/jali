/**
 * The timeline: the session's four tracks as waveforms on one time axis, with the markers on a ruler and the
 * playhead across them all. Click or drag to seek; with focus, the arrows step a second (Shift: five), Home and End go
 * to the ends. A short, wide pane: it is built to sit under or over something.
 *
 * It draws on a canvas every frame while playing, and not at all while Jali says it is paused (folded, behind a tab,
 * tucked, behind a maximised pane). The sound is the engine's and carries on.
 */
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { WaveSineIcon } from "@phosphor-icons/react";
import { definePane, useActivity, useJaliState, useTheme, type PaneProps } from "@jali/react";
import { cue } from "../actions";
import { useFrame, useTransport } from "../audio/react";
import { audible, useSessionView, type SessionView } from "../edits";
import { useServices } from "../services";
import { clock, sessionById, trackOf, TRACKS } from "../sessions/sessions";
import { Empty, NotInTransport } from "../ui/parts";
import { drawBars, loudest, paletteOf, prepare, trackPeaks, useSize } from "../ui/waveform";
import { followSession } from "./follow";

const timelineParams = { session: String };
const RULER = 24;
/** Each lane's share of the height: the voices first, the sting smallest. */
const LANE_WEIGHT: Record<string, number> = { "mic-a": 1.25, "mic-b": 1.25, bed: 1, sting: 0.7 };

function Timeline(props: PaneProps<typeof timelineParams>) {
  const { edits } = useServices();
  const view = useSessionView(edits, props.params.session);
  if (!view) return <Empty title="No such session" />;
  return <TimelineBody {...props} view={view} />;
}

function TimelineBody({ paused, view }: PaneProps<typeof timelineParams> & { view: SessionView }) {
  const { engine } = useServices();
  const { session } = view;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  const [hover, setHover] = useState<number | null>(null);
  const inTransport = useTransport((s) => s.session === session.id);
  const loading = useTransport((s) => s.session === session.id && s.status === "loading");
  const rendered = useTransport((s) => s.rendered.includes(session.id));
  const loop = useTransport((s) => (s.session === session.id ? s.loop : null));
  const theme = useTheme();
  const at = useTransport((s) => s.at);

  // The segments some list has selected (a transcript's cursor): outlined on their lanes.
  const selection = useJaliState((s) => s.selection);
  const selected = useMemo(
    () =>
      new Set(
        Object.values(selection)
          .filter((sel) => sel.ref.kind === "clip" && sel.ref.params.session === session.id)
          .map((sel) => String(sel.ref.params.segment)),
      ),
    [selection, session.id],
  );

  // "idle", not undefined: undefined leaves "loading" standing once the music has rendered (FINDINGS.md).
  useActivity(loading ? "loading" : "idle");

  const lanes = useMemo(() => {
    const total = TRACKS.reduce((s, t) => s + LANE_WEIGHT[t.id]!, 0);
    let y = RULER;
    return TRACKS.map((t) => {
      const h = ((height - RULER) * LANE_WEIGHT[t.id]!) / total;
      const lane = { track: t, y, h };
      y += h;
      return lane;
    });
  }, [height]);

  const timeAt = (x: number) => Math.max(0, Math.min(session.duration, (x / width) * session.duration));

  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g) return;
      const c = paletteOf(canvas.current!);
      const x = (t: number) => (t / session.duration) * width;
      const playhead = inTransport ? pos : -1;

      // The ruler: a tick every five seconds, a label every ten (or twenty, when narrow).
      g.font = `500 10px ${getComputedStyle(canvas.current!).getPropertyValue("--jali-font-mono")}`;
      g.textBaseline = "middle";
      const every = width / session.duration < 9 ? 20 : 10;
      for (let t = 0; t <= session.duration; t += 5) {
        g.fillStyle = t % every === 0 ? c.lineStrong : c.line;
        g.fillRect(Math.round(x(t)), t % every === 0 ? 14 : 18, 1, RULER - (t % every === 0 ? 14 : 18));
        if (t % every === 0 && x(t) < width - 30) {
          g.fillStyle = c.faint;
          g.fillText(clock(t), Math.round(x(t)) + 4, 8);
        }
      }
      g.fillStyle = c.line;
      g.fillRect(0, RULER - 1, width, 1);

      // The loop, behind everything.
      if (loop) {
        g.fillStyle = c.signalSoft;
        g.fillRect(x(loop.start), RULER, x(loop.end) - x(loop.start), height - RULER);
        g.fillStyle = c.played;
        g.fillRect(Math.round(x(loop.start)), RULER, 1, height - RULER);
        g.fillRect(Math.round(x(loop.end)), RULER, 1, height - RULER);
      }

      for (const { track, y, h } of lanes) {
        const live = audible(view.edits, track.id);
        g.globalAlpha = live ? 1 : 0.35;
        if (track.kind === "voice") {
          for (const seg of session.segments) {
            if (trackOf(seg) !== track.id) continue;
            const x0 = x(seg.start);
            const x1 = x(seg.end);
            g.fillStyle = c.line;
            g.beginPath();
            g.roundRect(x0, y + 3, x1 - x0, h - 6, 4);
            g.fill();
            if (selected.has(seg.id)) {
              g.strokeStyle = c.played;
              g.lineWidth = 1.5;
              g.stroke();
            }
          }
        }
        const peaks = trackPeaks(engine, session, track.id);
        if (peaks) {
          drawBars(
            g,
            peaks,
            { x: 0, y: y + 5, w: width, h: h - 10 },
            { from: 0, to: session.duration },
            {
              idle: track.kind === "voice" ? c.idle : c.music,
              played: c.played,
              bar: 2,
              gap: 1,
            },
            playhead,
            null,
            0.95 / loudest(peaks),
          );
        } else {
          g.fillStyle = c.faint;
          g.fillText(loading ? "Rendering…" : "", 8, y + h / 2);
        }
        g.globalAlpha = 1;
        g.fillStyle = c.line;
        g.fillRect(0, Math.round(y + h) - 1, width, 1);
      }

      // Markers: a flag on the ruler, a faint line down the lanes.
      for (const m of view.markers) {
        const mx = Math.round(x(m.time));
        g.fillStyle = c.lineStrong;
        g.fillRect(mx, RULER, 1, height - RULER);
        g.fillStyle = c.played;
        g.beginPath();
        g.moveTo(mx, RULER - 1);
        g.lineTo(mx, RULER - 10);
        g.lineTo(mx + 7, RULER - 6);
        g.closePath();
        g.fill();
      }

      if (hover !== null) {
        g.fillStyle = c.subtle;
        g.globalAlpha = 0.45;
        g.fillRect(Math.round(hover), RULER, 1, height - RULER);
        g.globalAlpha = 1;
      }
      if (playhead >= 0) {
        const px = Math.round(x(playhead));
        g.fillStyle = c.played;
        g.fillRect(px - 1, 0, 2, height);
        g.beginPath();
        g.roundRect(px - 5, 2, 10, 9, 2.5);
        g.fill();
      }
    },
    [width, height, lanes, selected, loop, theme, rendered, hover, view, inTransport, at],
  );

  // Drag to scrub: the sound pauses while the pointer is down and plays on from where it lets go.
  const drag = useRef<{ wasPlaying: boolean } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = timeAt(e.clientX - e.currentTarget.getBoundingClientRect().left);
    if (!inTransport) return cue(engine, session.id, t);
    drag.current = { wasPlaying: engine.get().playing };
    engine.pause();
    engine.seek(t);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    setHover(px);
    if (drag.current) engine.seek(timeAt(px));
  };
  const onPointerUp = () => {
    if (drag.current?.wasPlaying) engine.play();
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const step = e.shiftKey ? 5 : 1;
    const pos = engine.position();
    const to =
      e.key === "ArrowLeft"
        ? pos - step
        : e.key === "ArrowRight"
          ? pos + step
          : e.key === "PageUp"
            ? pos - 10
            : e.key === "PageDown"
              ? pos + 10
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? session.duration
                  : null;
    if (to === null) return; // Space and the rest: not ours
    e.preventDefault();
    cue(engine, session.id, to, inTransport && engine.get().playing);
  };

  const pos = inTransport ? engine.position() : 0;
  return (
    <div className="pane-body timeline">
      {!inTransport ? <NotInTransport session={session.id} /> : null}
      <div className="tl-body">
        <ol className="tl-labels" aria-hidden style={{ paddingTop: RULER }}>
          {lanes.map(({ track, h }) => (
            <li key={track.id} style={{ height: h }} data-silent={audible(view.edits, track.id) ? undefined : ""}>
              <span className="tl-track">{track.label}</span>
              <span className="tl-who" hidden={h < 38}>
                {track.speaker ? view.speakerName(track.speaker) : track.kind === "music" ? "Synth pad" : "Synth bells"}
              </span>
            </li>
          ))}
        </ol>
        <div
          ref={box}
          className="tl-lanes"
          role="slider"
          tabIndex={0}
          aria-label={`Playhead in ${session.title}`}
          aria-valuemin={0}
          aria-valuemax={Math.round(session.duration)}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${clock(pos)} of ${clock(session.duration)}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
        >
          <canvas ref={canvas} />
        </div>
      </div>
    </div>
  );
}

export const timeline = definePane("timeline", {
  params: timelineParams,
  title: ({ session }) => `Timeline · ${sessionById(session)?.title ?? session}`,
  icon: WaveSineIcon,
  width: { min: 440, comfortable: 760 },
  height: { min: 190 },
  follow: followSession,
  Component: Timeline,
});
