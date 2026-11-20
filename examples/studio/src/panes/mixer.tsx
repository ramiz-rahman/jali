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
import { Missing, SessionMissing, NotInTransport } from "../ui/parts";
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

  useActivity(loading ? "loading" : playing ? "live" : undefined);
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
          {/* As a console prints it: +6 above the line, plain numbers below. A minus beside each tick reads as two. */}
          <span>{db > 0 ? `+${db}` : Math.abs(db)}</span>
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
          <span className="mx-word">mute</span>
          <span className="mx-short" aria-hidden>
            M
          </span>
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
          <span className="mx-word">solo</span>
          <span className="mx-short" aria-hidden>
            S
          </span>
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
 * Every meter in the mixer, drawn in one loop while the pane is on screen: each `.mx-meter` box gets a canvas.
 * The level falls back at 24 dB a second, and the peak holds for a second. It runs every frame for every strip, so a
 * frame allocates nothing: the boxes are a live collection, each meter's record (its canvas, lamp and levels) is
 * made once, the palette is resolved once per theme, and the engine's reading is updated in place.
 */
/** The meters' middle zone, between the pale low cells and the orange top: an extension of the accent rules. */
const AMBER = "#f2b33d";
/** One LED cell's height, with a pixel between cells. */
const CELL = 3;

interface MeterRecord {
  canvas: HTMLCanvasElement;
  /** The master's clip lamp, for "master-l" and "master-r". */
  lamp: HTMLElement | null;
  level: number;
  hold: number;
  heldAt: number;
  clippedAt: number;
}

function Meters({ paused, engineReady }: { paused: boolean; engineReady: boolean }) {
  const { engine } = useServices();
  const root = useRef<HTMLSpanElement>(null);
  const records = useRef(new WeakMap<HTMLElement, MeterRecord>());
  const boxes = useRef<HTMLCollectionOf<Element> | null>(null);
  const last = useRef(0);
  const theme = useTheme();
  const { width } = useSize(root);
  useFrame(paused, () => {
    const strips = root.current?.closest(".mixer");
    if (!strips) return;
    // Live: it follows the strips as a session's tracks come and go.
    boxes.current ??= strips.getElementsByClassName("mx-meter");
    const now = performance.now();
    const dt = Math.min(0.1, last.current ? (now - last.current) / 1000 : 0);
    last.current = now;
    const c = screenPaletteOf();
    for (let i = 0; i < boxes.current.length; i++) {
      const box = boxes.current[i];
      if (!(box instanceof HTMLElement)) continue;
      const id = box.dataset.meter;
      if (!id) continue;
      let r = records.current.get(box);
      if (!r) {
        r = {
          canvas: box.querySelector("canvas") ?? box.appendChild(document.createElement("canvas")),
          lamp: strips.querySelector<HTMLElement>(`[data-clip="${CSS.escape(id)}"]`),
          level: -60,
          hold: -60,
          heldAt: 0,
          clippedAt: -1e9,
        };
        records.current.set(box, r);
      }
      const w = box.clientWidth;
      const h = box.clientHeight;
      const g = prepare(r.canvas, w, h);
      if (!g) continue;
      const peak = engine.meter(id).peak;
      r.level = Math.max(peak, r.level - 24 * dt);
      if (peak >= r.hold || now - r.heldAt > 1000) {
        r.hold = peak;
        r.heldAt = now;
      }
      // A ladder of LED cells on the fader's scale, so a level reads against the fader beside it: pale up to
      // −12 dB, amber to −3, signal orange above. The peak holds for a second as one lit cell.
      const hot = h - dbToFader(-3) * h;
      const warm = h - dbToFader(-12) * h;
      const top = r.level > -59 ? h - dbToFader(r.level) * h : h + 1;
      for (let cy = h - CELL; cy >= 0; cy -= CELL + 1) {
        g.fillStyle = cy + CELL > top ? (cy < hot ? c.played : cy < warm ? AMBER : c.text) : c.line;
        g.fillRect(0, cy, w, CELL);
      }
      if (r.hold > -59) {
        const hy = Math.max(0, Math.min(h - CELL, Math.round(h - dbToFader(r.hold) * h)));
        g.fillStyle = hy < hot ? c.played : hy < warm ? AMBER : c.text;
        g.fillRect(0, hy, w, 2);
      }
      // The master's clip lamps: lit for two seconds after a peak within 0.5 dB of full scale.
      if (r.lamp) {
        if (peak > -0.5) r.clippedAt = now;
        r.lamp.toggleAttribute("data-on", now - r.clippedAt < 2000);
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
  Missing: SessionMissing,
});
