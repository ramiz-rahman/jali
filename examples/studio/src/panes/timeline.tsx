/**
 * The timeline: the session's tracks (three, four or eight) as waveforms on one time axis, with the markers on a ruler and the
 * playhead across them all. Click or drag to seek; with focus, the arrows step a second (Shift: five), Home and End go
 * to the ends. A short, wide pane: it is built to sit under or over something.
 *
 * It draws on a canvas every frame while playing, and not at all while Jali says it is paused (folded, behind a tab,
 * tucked, behind a maximised pane). The sound is the engine's and carries on.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { WaveSineIcon } from "@phosphor-icons/react";
import { definePane, useActivity, useJaliState, useTheme, type PaneProps } from "@jali/react";
import { cue } from "../actions";
import { useFrame, useTransport } from "../audio/react";
import { audible, channelOf, useSessionView, type SessionView } from "../edits";
import { useServices } from "../services";
import {
  clock,
  colourOf,
  hasTranscript,
  sessionById,
  trackInput,
  trackName,
  trackOf,
} from "../sessions/sessions";
import { Missing, NotInTransport } from "../ui/parts";
import { drawBars, loudest, screenPaletteOf, prepare, trackPeaks, useSize } from "../ui/waveform";
import { followSession } from "./follow";

const timelineParams = { session: String };
/** The ruler: a row of timecodes over a row of flags. */
const RULER = 36;
/** Each lane's share of the height: a track with words in the transcript a little more than one without. */
const laneWeight = (withWords: boolean) => (withWords ? 1.25 : 1);
const pad = (h: number) => Math.max(1.5, Math.min(5, h * 0.12));

function Timeline(props: PaneProps<typeof timelineParams>) {
  const { edits } = useServices();
  const view = useSessionView(edits, props.params.session);
  if (!view) return <Missing what="session" openHere={props.openHere} />;
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

  // "idle", not undefined: undefined leaves "loading" standing once the tracks have decoded (FINDINGS.md).
  useActivity(loading ? "loading" : "idle");

  const lanes = useMemo(() => {
    const weights = session.tracks.map((t) => laneWeight(hasTranscript(session, t.id)));
    const total = weights.reduce((a, b) => a + b, 0);
    let y = RULER;
    return session.tracks.map((t, i) => {
      const h = ((height - RULER) * weights[i]!) / total;
      const lane = { track: t, y, h };
      y += h;
      return lane;
    });
  }, [height, session]);

  const timeAt = (x: number) =>
    Math.max(0, Math.min(session.duration, (x / width) * session.duration));

  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g) return;
      const c = screenPaletteOf(canvas.current!);
      const x = (t: number) => (t / session.duration) * width;
      const playhead = inTransport ? pos : -1;

      // The ruler: timecodes printed on its top row, a long tick for each and a short one every second; the flags'
      // row below them.
      g.font = `500 10px ${getComputedStyle(canvas.current!).getPropertyValue("--font-readout")}`;
      g.textBaseline = "middle";
      const every = width / session.duration < 9 ? 20 : 10;
      const perSecond = width / session.duration >= 6;
      for (let t = 0; t <= session.duration; t += 1) {
        const major = t % every === 0;
        const mid = t % 5 === 0;
        if (!major && !mid && !perSecond) continue;
        g.fillStyle = major ? c.lineStrong : c.line;
        const top = major ? 2 : mid ? RULER - 8 : RULER - 4;
        g.fillRect(Math.round(x(t)), top, 1, major ? 12 : RULER - top);
        if (major) g.fillRect(Math.round(x(t)), RULER - 8, 1, 8);
        if (major && x(t) < width - 34) {
          g.fillStyle = c.subtle;
          g.fillText(clock(t), Math.round(x(t)) + 4, 8);
        }
      }
      g.fillStyle = c.line;
      g.fillRect(0, RULER - 1, width, 1);

      // The loop: two orange lines down the lanes and a bar across the ruler's foot. No fill on the glass.
      if (loop) {
        g.fillStyle = c.played;
        g.fillRect(x(loop.start), RULER - 3, x(loop.end) - x(loop.start), 2);
        g.fillRect(Math.round(x(loop.start)), RULER, 1, height - RULER);
        g.fillRect(Math.round(x(loop.end)), RULER, 1, height - RULER);
      }

      for (const { track, y, h } of lanes) {
        const live = audible(view.edits, track.id, session.tracks);
        g.globalAlpha = live ? 1 : 0.35;
        if (track.kind === "voice") {
          for (const seg of session.segments) {
            if (trackOf(seg) !== track.id) continue;
            const x0 = x(seg.start);
            const x1 = x(seg.end);
            // A segment's block on its lane; the selected one lit from behind, like a lamp under glass.
            // The selected one is bracketed, not filled: an orange in and out line with short arms.
            const lit = selected.has(seg.id);
            if (lit) {
              const a = Math.round(x0);
              const b = Math.round(x1);
              g.fillStyle = c.played;
              g.fillRect(a, y + 2, 2, h - 4);
              g.fillRect(b - 2, y + 2, 2, h - 4);
              g.fillRect(a, y + 2, 6, 2);
              g.fillRect(a, y + h - 4, 6, 2);
              g.fillRect(b - 6, y + 2, 6, 2);
              g.fillRect(b - 6, y + h - 4, 6, 2);
            }
          }
        }
        const peaks = trackPeaks(session, track.id);
        {
          drawBars(
            g,
            peaks,
            // A lane keeps 5px of glass above and below its bars, less when eight tracks share a short pane.
            { x: 0, y: y + pad(h), w: width, h: h - 2 * pad(h) },
            { from: 0, to: session.duration },
            {
              idle: hasTranscript(session, track.id) ? c.idle : c.music,
              played: c.played,
              bar: 2,
              gap: 1,
            },
            playhead,
            null,
            0.95 / loudest(peaks),
          );
        }
        g.globalAlpha = 1;
        g.fillStyle = c.line;
        g.fillRect(0, Math.round(y + h) - 1, width, 1);
      }

      // Markers: a flag on the ruler with its name printed beside it when there is room before the next one, and a
      // faint line down the lanes.
      const ms = [...view.markers].sort((a, b) => a.time - b.time);
      ms.forEach((m, i) => {
        const mx = Math.round(x(m.time));
        const next = ms[i + 1] ? x(ms[i + 1]!.time) : width;
        g.fillStyle = c.lineStrong;
        g.fillRect(mx, RULER, 1, height - RULER);
        g.fillStyle = c.played;
        g.beginPath();
        g.moveTo(mx, RULER - 1);
        g.lineTo(mx, RULER - 16);
        g.lineTo(mx + 7, RULER - 16);
        g.lineTo(mx + 7, RULER - 9);
        g.lineTo(mx + 1, RULER - 9);
        g.closePath();
        g.fill();
        const label = m.label;
        const w = g.measureText(label).width;
        if (mx + 10 + w + 6 < next) {
          g.fillStyle = c.text;
          g.fillText(label, mx + 10, RULER - 12);
        }
      });
      // Hover: a line down the lanes and the time under the pointer, on a small tag at the foot.
      if (hover !== null) {
        const hx = Math.round(hover);
        g.fillStyle = c.subtle;
        g.globalAlpha = 0.5;
        g.fillRect(hx, RULER, 1, height - RULER);
        g.globalAlpha = 1;
        const label = clock(timeAt(hover));
        const tw = g.measureText(label).width + 8;
        const tx = Math.min(width - tw, Math.max(0, hx - tw / 2));
        g.fillStyle = c.lineStrong;
        g.fillRect(tx, height - 15, tw, 14);
        g.fillStyle = c.text;
        g.fillText(label, tx + 4, height - 7);
      }
      // The playhead: a hairline with a cap at the ruler, a pointed foot so it reads which instant it marks.
      if (playhead >= 0) {
        const px = Math.round(x(playhead));
        g.fillStyle = c.played;
        g.fillRect(px - 1, 12, 2, height - 12);
        // Its cap sits in the timecodes' row, so it never covers a marker's name.
        g.beginPath();
        g.moveTo(px - 6, 1);
        g.lineTo(px + 6, 1);
        g.lineTo(px + 6, 8);
        g.lineTo(px, 14);
        g.lineTo(px - 6, 8);
        g.closePath();
        g.fill();
        g.fillStyle = "rgb(255 255 255 / 0.5)";
        g.fillRect(px - 5, 2, 10, 1);
      }
    },
    [width, height, lanes, selected, loop, theme, hover, view, inTransport, at],
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

  // The wheel or a trackpad moves the playhead: 100 of delta is a second, as on the scrub dial.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom is the browser's
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      cue(engine, session.id, engine.position() + d / 100, inTransport && engine.get().playing);
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [engine, session.id, inTransport]);

  // All headers take the compact form together, so one timeline never mixes the two.
  const compact = lanes.some((l) => l.h < 30);
  const pos = inTransport ? engine.position() : 0;
  return (
    <div className="pane-body timeline">
      {!inTransport ? <NotInTransport session={session.id} /> : null}
      <div className="tl-body">
        {/* Track headers: the mixer's scribble strips, in the mixer's order, with its lamps mirrored. */}
        <ol className="tl-labels" style={{ paddingTop: RULER }} aria-label="Tracks">
          {lanes.map(({ track, h }) => {
            const ch = channelOf(view.edits, track.id);
            return (
              <li
                key={track.id}
                style={{ height: h }}
                data-channel={colourOf(session, track.id)}
                data-silent={audible(view.edits, track.id, session.tracks) ? undefined : ""}
                data-short={h < 38 ? "" : undefined}
                data-compact={compact ? "" : undefined}
                title={`${trackInput(track)}: ${trackName(track, view.speakerName, view.session)}`}
              >
                <span className="mx-lamp" />
                <span className="tl-track">{trackInput(track)}</span>
                <span className="tl-who">{trackName(track, view.speakerName, view.session)}</span>
                <span className="tl-ms">
                  <span className="tl-m" data-on={ch.mute ? "" : undefined}>
                    M
                  </span>
                  <span className="tl-s" data-on={ch.solo ? "" : undefined}>
                    S
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <div
          ref={box}
          className="tl-lanes screen"
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
  // Room for four legible lanes under the ruler, with the "not loaded" note.
  height: { min: 230 },
  follow: followSession,
  Component: Timeline,
});
