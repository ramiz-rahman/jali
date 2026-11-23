/**
 * The timeline: the session's tracks (three, four or eight) as waveforms on one time axis, with the markers on a
 * ruler and the playhead across them all. Click or drag to seek; with focus, the arrows step a second (Shift: five),
 * Home and End go to the ends. A short, wide pane: it is built to sit under or over something.
 *
 * It draws on a canvas every frame while playing (draw.ts), and not at all while Jali says it is paused (folded,
 * behind a tab, tucked, behind a maximised pane). The sound is the engine's and carries on.
 */
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { WaveSineIcon } from "@phosphor-icons/react";
import { useActivity, useJaliState } from "jali/react";
import { useFrame, useTransport } from "../../audio/react";
import { clamp } from "../../numbers";
import { useServices } from "../../services";
import { colourOf, envelopeOf, hasTranscript, trackInput } from "../../sessions/derive";
import { clock } from "../../sessions/format";
import { prepare, screenPalette, useSize } from "../../ui/lib/canvas";
import { keyTarget, useWheel, wheelDelta } from "../../ui/lib/input";
import { clipOf } from "../clip";
import { NotInTransport } from "../states";
import { defineSessionPane, type SessionPaneProps } from "../sessionPane";
import { drawTimeline, RULER, type Lane } from "./draw";

/** Each lane's share of the height: a track with words in the transcript a little more than one without. */
const laneWeight = (withWords: boolean) => (withWords ? 1.25 : 1);

function Timeline({ paused, view, transport }: SessionPaneProps) {
  const { engine } = useServices();
  const { session } = view;
  const { inTransport, loading, loop } = transport;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = useSize(box);
  const [hover, setHover] = useState<number | null>(null);
  const at = useTransport((s) => s.at);
  useActivity(loading ? "loading" : undefined);

  // The segments some list has selected (a transcript's cursor): bracketed on their lanes.
  const selection = useJaliState((s) => s.selection);
  const selected = useMemo(
    () =>
      new Set(
        Object.values(selection).flatMap((sel) => {
          const c = clipOf(sel.ref);
          return c?.session === session.id ? [c.segment] : [];
        }),
      ),
    [selection, session.id],
  );

  const lanes = useMemo((): Lane[] => {
    const withWords = session.tracks.map((t) => hasTranscript(session, t.id));
    const total = withWords.reduce((sum, w) => sum + laneWeight(w), 0);
    let y = RULER;
    return session.tracks.map((track, i) => {
      const h = ((height - RULER) * laneWeight(withWords[i]!)) / total;
      const lane = {
        track,
        y,
        h,
        envelope: envelopeOf(track),
        withWords: withWords[i]!,
        heard: view.heard(track.id),
        selected:
          track.kind === "voice"
            ? session.segments.filter((s) => s.track === track.id && selected.has(s.id))
            : [],
      };
      y += h;
      return lane;
    });
  }, [height, session, view, selected]);

  useFrame(
    paused,
    (pos) => {
      const g = prepare(canvas.current, width, height);
      if (!g) return;
      drawTimeline(
        g,
        {
          width,
          height,
          duration: session.duration,
          lanes,
          markers: view.markers,
          loop,
          hover,
          playhead: inTransport ? pos : -1,
        },
        screenPalette(),
      );
    },
    [width, height, lanes, loop, hover, view, inTransport, at],
  );

  const timeAt = (x: number) => clamp((x / width) * session.duration, 0, session.duration);
  const xAt = (e: PointerEvent<HTMLDivElement>) =>
    e.clientX - e.currentTarget.getBoundingClientRect().left;
  /** Move the playhead to `t`: heard as a scrub while this session plays, else put in the transport there. */
  const scrubTo = (t: number) => (inTransport ? engine.scrub(t) : engine.cue(session.id, t));

  // Drag to scrub: the sound follows the pointer, and plays on from where it rests.
  const drag = useRef(false);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = inTransport;
    scrubTo(timeAt(xAt(e)));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    setHover(xAt(e));
    if (drag.current) engine.scrub(timeAt(xAt(e)));
  };
  const onPointerUp = () => {
    drag.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const pos = engine.position();
    const step = e.shiftKey ? 5 : 1;
    const to = keyTarget(e, {
      ArrowLeft: pos - step,
      ArrowRight: pos + step,
      PageUp: pos - 10,
      PageDown: pos + 10,
      Home: 0,
      End: session.duration,
    });
    if (to === undefined) return; // Space and the rest: not ours
    e.preventDefault();
    engine.cue(session.id, to, inTransport && engine.get().playing);
  };

  // The wheel or a trackpad moves the playhead: 100 of delta is a second, as on the scrub dial.
  useWheel(box, (e) => {
    if (e.ctrlKey) return false; // pinch-zoom is the browser's
    scrubTo(engine.position() + wheelDelta(e) / 100);
  });

  // All headers take the compact form together, so one timeline never mixes the two.
  const compact = lanes.some((l) => l.h < 30);
  const pos = inTransport ? engine.position() : 0;
  return (
    <div className="pane-body timeline">
      {!inTransport ? <NotInTransport session={session.id} /> : null}
      <div className="tl-body">
        {/* Track headers: the mixer's scribble strips, in the mixer's order, with its lamps mirrored. */}
        <ol className="tl-labels" style={{ paddingTop: RULER }} aria-label="Tracks">
          {lanes.map(({ track, h, heard }) => {
            const ch = view.channel(track.id);
            const name = view.trackName(track);
            return (
              <li
                key={track.id}
                style={{ height: h }}
                data-channel={colourOf(session, track.id)}
                data-silent={heard ? undefined : ""}
                data-short={h < 38 ? "" : undefined}
                data-compact={compact ? "" : undefined}
                title={`${trackInput(track)}: ${name}`}
              >
                <span className="mx-lamp" />
                <span className="tl-track">{trackInput(track)}</span>
                <span className="tl-who">{name}</span>
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

export const timeline = defineSessionPane("timeline", {
  name: "Timeline",
  icon: WaveSineIcon,
  width: { min: 440, comfortable: 760 },
  // Room for four legible lanes under the ruler, with the "not loaded" note, and about that at any window height: a
  // tall window gives the rest to the pane above or below it.
  height: { min: 230, comfortable: 240, max: 260 },
  Body: Timeline,
});
