/**
 * The mixer: one strip a track (fader, pan, mute, solo, a live meter) and the master. It works on the real audio
 * graph through the app's edits store: a fader writes the session's mix, and the engine applies it, so the mix holds
 * whether the mixer is on screen, folded into a tab or tucked away. Only the meters stop: they draw while Jali says
 * the pane is on screen, and the sound goes on regardless.
 *
 * While the transport plays its session, the mixer reports "working": the sound is going through it, even when it
 * is hidden, so its tab and shelf chip say so.
 */
import { useRef } from "react";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import { definePane, useActivity, useCommands, useTheme, type PaneProps } from "@jali/react";
import { useFrame, useTransport } from "../audio/react";
import { channelOf, useSessionView, type SessionView } from "../edits";
import { useServices } from "../services";
import { sessionById, TRACKS, type Track } from "../sessions/sessions";
import { Empty, NotInTransport } from "../ui/parts";
import { paletteOf, prepare, useSize } from "../ui/waveform";
import { followSession } from "./follow";

const mixerParams = { session: String };

/** Fader travel to dB and back: +6 at the top, -6 at the middle, silence at the bottom. */
export const faderToDb = (p: number) => (p <= 0.032 ? -60 : 40 * Math.log10(p) + 6);
export const dbToFader = (db: number) => (db <= -60 ? 0 : Math.min(1, 10 ** ((db - 6) / 40)));
const dbLabel = (db: number) =>
  db <= -60 ? "−∞" : `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(db).toFixed(1)}`;
const panLabel = (p: number) =>
  Math.abs(p) < 0.02 ? "C" : `${p < 0 ? "L" : "R"}${Math.round(Math.abs(p) * 100)}`;

function Mixer({ params, paused }: PaneProps<typeof mixerParams>) {
  const { edits, engine } = useServices();
  const view = useSessionView(edits, params.session);
  const inTransport = useTransport((s) => s.session === params.session);
  const playing = useTransport((s) => s.playing && s.session === params.session);
  const loading = useTransport((s) => s.session === params.session && s.status === "loading");

  // "idle", not undefined: undefined leaves the last report standing (FINDINGS.md).
  useActivity(loading ? "loading" : playing ? "working" : "idle");
  useCommands([
    {
      id: "reset",
      title: "Reset the mix",
      run: () => edits.resetMix(params.session),
    },
    {
      id: "unmute",
      title: "Unmute and unsolo every track",
      run: () =>
        TRACKS.forEach((t) => edits.setChannel(params.session, t.id, { mute: false, solo: false })),
    },
  ]);

  if (!view) return <Empty title="No such session" />;
  return (
    <div className="pane-body mixer">
      {!inTransport ? <NotInTransport session={params.session} /> : null}
      <div className="mx-strips" role="group" aria-label={`Mixer for ${view.session.title}`}>
        {TRACKS.map((t) => (
          <Strip key={t.id} track={t} view={view} />
        ))}
        <Master view={view} />
      </div>
      <Meters paused={paused || !inTransport} engineReady={engine.audio} />
    </div>
  );
}

function Strip({ track, view }: { track: Track; view: SessionView }) {
  const { edits } = useServices();
  const ch = channelOf(view.edits, track.id);
  const session = view.session.id;
  const name = track.speaker
    ? view.speakerName(track.speaker)
    : track.kind === "music"
      ? "Synth pad"
      : "Synth bells";
  const anySolo = TRACKS.some((t) => channelOf(view.edits, t.id).solo);
  const silent = ch.mute || (anySolo && !ch.solo);
  return (
    <section
      className="mx-strip"
      data-kind={track.kind}
      data-silent={silent ? "" : undefined}
      aria-label={`${track.label}, ${name}`}
    >
      <header className="mx-head">
        <span className="mx-label">{track.label}</span>
        <span className="mx-name" title={name}>
          {name}
        </span>
      </header>
      <label className="mx-pan">
        <span className="sr-only">Pan for {track.label}</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={Math.round(ch.pan * 100)}
          onChange={(e) =>
            edits.setChannel(session, track.id, { pan: Number(e.target.value) / 100 })
          }
          onDoubleClick={() => edits.setChannel(session, track.id, { pan: 0 })}
          aria-valuetext={panLabel(ch.pan)}
        />
        <span className="mx-readout mono" aria-hidden>
          {panLabel(ch.pan)}
        </span>
      </label>
      <div className="mx-fader-row">
        <div className="mx-meter" data-meter={track.id} aria-hidden />
        <label className="mx-fader">
          <span className="sr-only">Level for {track.label}</span>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(dbToFader(ch.gain) * 1000)}
            onChange={(e) =>
              edits.setChannel(session, track.id, {
                gain: Math.round(faderToDb(Number(e.target.value) / 1000) * 10) / 10,
              })
            }
            onDoubleClick={() => edits.setChannel(session, track.id, { gain: 0 })}
            aria-valuetext={`${dbLabel(ch.gain)} dB`}
          />
        </label>
        <Scale />
      </div>
      <span className="mx-db mono">{dbLabel(ch.gain)} dB</span>
      <div className="mx-buttons">
        <button
          type="button"
          className="mx-btn"
          data-role="mute"
          aria-pressed={ch.mute}
          aria-label={`Mute ${track.label}`}
          title="Mute"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => edits.setChannel(session, track.id, { mute: !ch.mute })}
        >
          M
        </button>
        <button
          type="button"
          className="mx-btn"
          data-role="solo"
          aria-pressed={ch.solo}
          aria-label={`Solo ${track.label}`}
          title="Solo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => edits.setChannel(session, track.id, { solo: !ch.solo })}
        >
          S
        </button>
      </div>
    </section>
  );
}

function Master({ view }: { view: SessionView }) {
  const { edits } = useServices();
  const gain = view.edits.masterGain;
  return (
    <section className="mx-strip mx-master" aria-label="Master">
      <header className="mx-head">
        <span className="mx-label">Master</span>
        <span className="mx-name">Stereo out</span>
      </header>
      <div className="mx-pan mx-pan-blank" aria-hidden />
      <div className="mx-fader-row">
        <div className="mx-meter" data-meter="master-l" aria-hidden />
        <div className="mx-meter" data-meter="master-r" aria-hidden />
        <label className="mx-fader">
          <span className="sr-only">Master level</span>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round(dbToFader(gain) * 1000)}
            onChange={(e) =>
              edits.setMasterGain(
                view.session.id,
                Math.round(faderToDb(Number(e.target.value) / 1000) * 10) / 10,
              )
            }
            onDoubleClick={() => edits.setMasterGain(view.session.id, 0)}
            aria-valuetext={`${dbLabel(gain)} dB`}
          />
        </label>
        <Scale />
      </div>
      <span className="mx-db mono">{dbLabel(gain)} dB</span>
      <div className="mx-buttons">
        <button
          type="button"
          className="mx-btn mx-btn-wide"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => edits.resetMix(view.session.id)}
          title="Reset every fader, pan, mute and solo"
        >
          Reset
        </button>
      </div>
    </section>
  );
}

const TICKS = [6, 0, -6, -12, -24, -48];
function Scale() {
  return (
    <ol className="mx-scale mono" aria-hidden>
      {TICKS.map((db) => (
        <li key={db} style={{ bottom: `${dbToFader(db) * 100}%` }}>
          {db > 0 ? `+${db}` : db}
        </li>
      ))}
    </ol>
  );
}

/**
 * Every meter in the mixer, drawn in one loop while the pane is on screen: each `[data-meter]` box gets a canvas.
 * The level falls back at 24 dB a second, and the peak holds for a second.
 */
function Meters({ paused, engineReady }: { paused: boolean; engineReady: boolean }) {
  const { engine } = useServices();
  const root = useRef<HTMLSpanElement>(null);
  const state = useRef(new Map<string, { level: number; hold: number; heldAt: number }>());
  const last = useRef(0);
  const theme = useTheme();
  const { width } = useSize(root);
  useFrame(paused, () => {
    const strips = root.current?.closest(".mixer");
    if (!strips) return;
    const now = performance.now();
    const dt = Math.min(0.1, last.current ? (now - last.current) / 1000 : 0);
    last.current = now;
    for (const box of strips.querySelectorAll<HTMLElement>("[data-meter]")) {
      let canvas = box.querySelector("canvas");
      if (!canvas) canvas = box.appendChild(document.createElement("canvas"));
      const w = box.clientWidth;
      const h = box.clientHeight;
      const g = prepare(canvas, w, h);
      if (!g) continue;
      const c = paletteOf(box);
      const id = box.dataset.meter!;
      const m = engine.meter(id);
      const s = state.current.get(id) ?? { level: -60, hold: -60, heldAt: 0 };
      s.level = Math.max(m.peak, s.level - 24 * dt);
      if (m.peak >= s.hold || now - s.heldAt > 1000) {
        s.hold = m.peak;
        s.heldAt = now;
      }
      state.current.set(id, s);
      // The scale is the fader's: a level reads against the fader beside it.
      const y = (db: number) => h - dbToFader(db) * h;
      g.fillStyle = c.line;
      g.beginPath();
      g.roundRect(0, 0, w, h, w / 2);
      g.fill();
      if (s.level > -59) {
        const top = y(s.level);
        const hot = y(-9);
        g.save();
        g.beginPath();
        g.roundRect(0, 0, w, h, w / 2);
        g.clip();
        g.fillStyle = c.text;
        g.fillRect(0, Math.max(top, hot), w, h - Math.max(top, hot));
        if (top < hot) {
          g.fillStyle = c.played;
          g.fillRect(0, top, w, hot - top);
        }
        g.restore();
      }
      if (s.hold > -59) {
        g.fillStyle = s.hold > -9 ? c.played : c.subtle;
        g.fillRect(0, Math.round(y(s.hold)), w, 2);
      }
    }
  }, [theme, width, engineReady]);
  return <span ref={root} className="mx-meters-anchor" aria-hidden />;
}

export const mixer = definePane("mixer", {
  params: mixerParams,
  title: ({ session }) => `Mixer · ${sessionById(session)?.title ?? session}`,
  icon: SlidersHorizontalIcon,
  width: { min: 420, comfortable: 520 },
  height: { min: 300 },
  follow: followSession,
  Component: Mixer,
});
