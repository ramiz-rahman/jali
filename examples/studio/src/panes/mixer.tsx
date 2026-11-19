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
import { colourOf, sessionById, trackInput, trackName, type Track } from "../sessions/sessions";
import { Empty, Missing, NotInTransport } from "../ui/parts";
import { dbToFader, Fader } from "../ui/Fader";
import { PanDial } from "../ui/Knob";
import { screenPaletteOf, prepare, useSize } from "../ui/waveform";
import { followSession } from "./follow";

const mixerParams = { session: String };

const dbLabel = (db: number) =>
  db <= -60 ? "−∞" : `${db > 0 ? "+" : db < 0 ? "−" : ""}${Math.abs(db).toFixed(1)}`;
const panText = (p: number) =>
  Math.abs(p) < 0.02
    ? "centre"
    : `${Math.round(Math.abs(p) * 100)} percent ${p < 0 ? "left" : "right"}`;
const panLabel = (p: number) =>
  Math.abs(p) < 0.02 ? "C" : `${p < 0 ? "L" : "R"}${Math.round(Math.abs(p) * 100)}`;

function Mixer({ params, paused, openHere }: PaneProps<typeof mixerParams>) {
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
        sessionById(params.session)?.tracks.forEach((t) =>
          edits.setChannel(params.session, t.id, { mute: false, solo: false }),
        ),
    },
  ]);

  if (!view) return <Missing what="session" openHere={openHere} />;
  return (
    <div className="pane-body mixer">
      {!inTransport ? <NotInTransport session={params.session} /> : null}
      <div
        className="mx-modules"
        role="group"
        aria-label={`Mixer for ${view.session.title}`}
        data-count={view.session.tracks.length}
      >
        {view.session.tracks.map((t) => (
          <Strip key={t.id} track={t} view={view} />
        ))}
        <Master view={view} />
      </div>
      <Meters paused={paused || !inTransport} engineReady={engine.audio} />
    </div>
  );
}

/** The printed scale beside every fader and meter: its ticks sit where the cap's centre line sits for that dB. */
const TICKS = [6, 0, -6, -12, -24, -48];
function Scale() {
  return (
    <ol className="mx-scale" aria-hidden>
      {TICKS.map((db) => (
        <li
          key={db}
          data-db={db}
          data-zero={db === 0 ? "" : undefined}
          style={{ bottom: `${dbToFader(db) * 100}%` }}
        >
          <span>{db > 0 ? `+${db}` : db}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A channel module: a plate of its own, cut from the faceplate. At its head a scribble strip (the input and its
 * name, the channel's lamp); then the pan dial; the meter, the scale and the long-throw fader, which take the
 * module's height; the level on a glass readout; mute and solo as latch keys.
 */
function Strip({ track, view }: { track: Track; view: SessionView }) {
  const { edits } = useServices();
  const ch = channelOf(view.edits, track.id);
  const session = view.session.id;
  const name = trackName(track, view.speakerName, view.session);
  const anySolo = view.session.tracks.some((t) => channelOf(view.edits, t.id).solo);
  const silent = ch.mute || (anySolo && !ch.solo);
  return (
    <section
      className="mx-module"
      data-channel={colourOf(view.session, track.id)}
      data-silent={silent ? "" : undefined}
      aria-label={`${track.label}, ${name}`}
    >
      <header className="mx-scribble">
        <span className="mx-lamp" aria-hidden />
        <span className="mx-label">{trackInput(track)}</span>
        <span className="mx-name" title={name}>
          {name}
        </span>
      </header>
      <div className="mx-pan">
        <PanDial
          label={`Pan for ${track.label}`}
          value={Math.round(ch.pan * 100)}
          cap={colourOf(view.session, track.id)}
          valueText={panText(ch.pan)}
          onChange={(v: number) => edits.setChannel(session, track.id, { pan: v / 100 })}
        />
        <span className="mx-pan-legend" aria-hidden>
          pan <b>{panLabel(ch.pan)}</b>
        </span>
      </div>
      <div className="mx-fader-row">
        <div className="mx-meter" data-meter={track.id} aria-hidden />
        <Scale />
        <Fader
          label={`Level for ${track.label}`}
          value={ch.gain}
          valueText={`${dbLabel(ch.gain)} dB`}
          onChange={(gain) => edits.setChannel(session, track.id, { gain })}
        />
      </div>
      <span className="screen mx-db" aria-hidden>
        {dbLabel(ch.gain)}
        <small> dB</small>
      </span>
      <div className="keyset mx-keys">
        <button
          type="button"
          className="key mx-btn"
          data-role="mute"
          aria-pressed={ch.mute}
          aria-label={`Mute ${track.label}`}
          title="Mute"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => edits.setChannel(session, track.id, { mute: !ch.mute })}
        >
          <span className="led" aria-hidden />
          mute
        </button>
        <button
          type="button"
          className="key mx-btn"
          data-role="solo"
          aria-pressed={ch.solo}
          aria-label={`Solo ${track.label}`}
          title="Solo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => edits.setChannel(session, track.id, { solo: !ch.solo })}
        >
          <span className="led" aria-hidden />
          solo
        </button>
      </div>
    </section>
  );
}

/**
 * The master: wider, a stereo meter with a clip lamp for each side, a graphite fader cap with an orange line, its
 * readout and a reset key.
 */
function Master({ view }: { view: SessionView }) {
  const { edits } = useServices();
  const gain = view.edits.masterGain;
  return (
    <section className="mx-module mx-master" aria-label="Master">
      <header className="mx-scribble">
        <span className="mx-lamp" aria-hidden />
        <span className="mx-label">master</span>
        <span className="mx-name">Stereo out</span>
      </header>
      <div className="mx-pan mx-clips" aria-hidden>
        <span className="mx-clip" data-clip="master-l">
          <span className="led" />L
        </span>
        <span className="mx-clip" data-clip="master-r">
          <span className="led" />R
        </span>
        <span className="mx-pan-legend">clip</span>
      </div>
      <div className="mx-fader-row">
        <div className="mx-meter" data-meter="master-l" aria-hidden />
        <div className="mx-meter" data-meter="master-r" aria-hidden />
        <Scale />
        <Fader
          label="Master level"
          className="fader-master"
          value={gain}
          valueText={`${dbLabel(gain)} dB`}
          onChange={(g) => edits.setMasterGain(view.session.id, g)}
        />
      </div>
      <span className="screen mx-db" aria-hidden>
        {dbLabel(gain)}
        <small> dB</small>
      </span>
      <div className="keyset mx-keys">
        <button
          type="button"
          className="key mx-btn mx-btn-wide"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => edits.resetMix(view.session.id)}
          title="Reset every fader, pan, mute and solo"
        >
          reset mix
        </button>
      </div>
    </section>
  );
}

/**
 * Every meter in the mixer, drawn in one loop while the pane is on screen: each `[data-meter]` box gets a canvas.
 * The level falls back at 24 dB a second, and the peak holds for a second.
 */
/** The meters' middle zone, between the pale low cells and the orange top: an extension of the accent rules. */
const AMBER = "#f2b33d";

function Meters({ paused, engineReady }: { paused: boolean; engineReady: boolean }) {
  const { engine } = useServices();
  const root = useRef<HTMLSpanElement>(null);
  const state = useRef(new Map<string, { level: number; hold: number; heldAt: number }>());
  const last = useRef(0);
  const clipped = useRef(new Map<string, number>());
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
      const c = screenPaletteOf(box);
      const id = box.dataset.meter!;
      const m = engine.meter(id);
      const s = state.current.get(id) ?? { level: -60, hold: -60, heldAt: 0 };
      s.level = Math.max(m.peak, s.level - 24 * dt);
      if (m.peak >= s.hold || now - s.heldAt > 1000) {
        s.hold = m.peak;
        s.heldAt = now;
      }
      state.current.set(id, s);
      // A ladder of LED cells on the fader's scale, so a level reads against the fader beside it: pale up to
      // −12 dB, amber to −3, signal orange above. The peak holds for a second as one lit cell.
      const y = (db: number) => h - dbToFader(db) * h;
      const cell = 3;
      const top = s.level > -59 ? y(s.level) : h + 1;
      const zone = (cy: number) => (cy < y(-3) ? c.played : cy < y(-12) ? AMBER : c.text);
      for (let cy = h - cell; cy >= 0; cy -= cell + 1) {
        const lit = cy + cell > top;
        g.fillStyle = lit ? zone(cy) : c.line;
        g.fillRect(0, cy, w, cell);
      }
      if (s.hold > -59) {
        const hy = Math.max(0, Math.min(h - cell, Math.round(y(s.hold))));
        g.fillStyle = zone(hy);
        g.fillRect(0, hy, w, 2);
      }
      // The master's clip lamps: lit for two seconds after a peak within 0.5 dB of full scale.
      if (id.startsWith("master")) {
        const lamp = strips.querySelector<HTMLElement>(`[data-clip="${id}"]`);
        if (m.peak > -0.5) clipped.current.set(id, now);
        const on = now - (clipped.current.get(id) ?? -1e9) < 2000;
        if (lamp) lamp.toggleAttribute("data-on", on);
      }
    }
  }, [theme, width, engineReady]);
  return <span ref={root} className="mx-meters-anchor" aria-hidden />;
}

export const mixer = definePane("mixer", {
  params: mixerParams,
  title: ({ session }) => `Mixer · ${sessionById(session)?.title ?? session}`,
  icon: SlidersHorizontalIcon,
  width: { min: 420, comfortable: 640 },
  height: { min: 340 },
  follow: followSession,
  Component: Mixer,
});
