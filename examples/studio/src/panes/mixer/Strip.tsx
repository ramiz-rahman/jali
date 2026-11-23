/**
 * The mixer's modules: one channel strip a track, and the master. Each is a plate of its own, cut from the
 * faceplate, with the same rows in the same heights, so their scales line up: a scribble strip, the pan dial (or the
 * master's clip lamps), the meter beside the printed scale and the long-throw fader, the level on a glass readout,
 * and the keys.
 */
import type { ReactNode } from "react";
import { MASTER_METERS } from "../../audio/graph";
import { dbLabel } from "../../levels";
import type { Channel } from "../../model/mix";
import type { SessionView } from "../../model/view";
import { colourOf, trackInput } from "../../sessions/derive";
import type { TrackData } from "../../sessions/types";
import { Key } from "../../ui/atoms/Key";
import { PanDial } from "../../ui/molecules/dial/PanDial";
import { Fader, dbToFader } from "../../ui/molecules/Fader";
import { ClipLamp, MeterBox } from "./meters";

const centred = (p: number) => Math.abs(p) < 0.02;
/** A pan position for a screen reader, and as the dial's legend prints it. */
const panText = (p: number) =>
  centred(p) ? "centre" : `${Math.round(Math.abs(p) * 100)} percent ${p < 0 ? "left" : "right"}`;
const panLabel = (p: number) =>
  centred(p) ? "C" : `${p < 0 ? "L" : "R"}${Math.round(Math.abs(p) * 100)}`;

/** A channel strip: a track's pan, fader, meter, mute and solo. */
export function Strip({ track, view }: { track: TrackData; view: SessionView }) {
  const ch = view.channel(track.id);
  const name = view.trackName(track);
  const colour = colourOf(view.session, track.id);
  const set = (patch: Partial<Channel>) => view.edit.setChannel(track.id, patch);
  return (
    <Module
      className="mx-module"
      channel={colour}
      silent={!view.heard(track.id)}
      label={`${track.label}, ${name}`}
      input={trackInput(track)}
      name={name}
      head={
        <div className="mx-pan">
          <PanDial
            label={`Pan for ${track.label}`}
            value={Math.round(ch.pan * 100)}
            cap={colour}
            valueText={panText(ch.pan)}
            onChange={(v) => set({ pan: v / 100 })}
          />
          <span className="mx-pan-legend" aria-hidden>
            pan <b>{panLabel(ch.pan)}</b>
          </span>
        </div>
      }
      meters={[track.id]}
      fader={{
        label: `Level for ${track.label}`,
        value: ch.gain,
        onChange: (gain) => set({ gain }),
      }}
    >
      <ChannelKey role="mute" track={track} on={ch.mute} toggle={() => set({ mute: !ch.mute })} />
      <ChannelKey role="solo" track={track} on={ch.solo} toggle={() => set({ solo: !ch.solo })} />
    </Module>
  );
}

/** The master: wider, a stereo meter with a clip lamp for each side, a graphite fader cap with an orange line. */
export function Master({ view }: { view: SessionView }) {
  return (
    <Module
      className="mx-module mx-master"
      label="Master"
      input="master"
      name="Stereo out"
      head={
        <div className="mx-pan mx-clips" aria-hidden>
          <ClipLamp id={MASTER_METERS.left} side="L" />
          <ClipLamp id={MASTER_METERS.right} side="R" />
          <span className="mx-pan-legend">clip</span>
        </div>
      }
      meters={[MASTER_METERS.left, MASTER_METERS.right]}
      fader={{
        label: "Master level",
        className: "fader-master",
        value: view.edits.masterGain,
        onChange: (g) => view.edit.setMasterGain(g),
      }}
    >
      <Key
        className="mx-btn mx-btn-wide"
        onClick={() => view.edit.resetMix()}
        title="Reset every fader, pan, mute and solo"
      >
        reset mix
      </Key>
    </Module>
  );
}

/** The rows every module has, in one order and one height each. */
function Module({
  className,
  channel,
  silent,
  label,
  input,
  name,
  head,
  meters,
  fader,
  children,
}: {
  className: string;
  /** The channel's colour (`data-channel`), for a track's strip. */
  channel?: string;
  silent?: boolean;
  label: string;
  /** The scribble strip: the input, and who or what is on it. */
  input: string;
  name: string;
  /** The row under the scribble strip. */
  head: ReactNode;
  /** What the meters beside the fader read. */
  meters: readonly string[];
  fader: { label: string; value: number; onChange(db: number): void; className?: string };
  /** The keys at the foot. */
  children: ReactNode;
}) {
  return (
    <section
      className={className}
      data-channel={channel}
      data-silent={silent ? "" : undefined}
      aria-label={label}
    >
      <header className="mx-scribble">
        <span className="mx-lamp" aria-hidden />
        <span className="mx-label">{input}</span>
        <span className="mx-name" title={name}>
          {name}
        </span>
      </header>
      {head}
      <div className="mx-fader-row">
        {meters.map((id) => (
          <MeterBox key={id} id={id} />
        ))}
        <Scale />
        <Fader
          label={fader.label}
          className={fader.className}
          value={fader.value}
          valueText={`${dbLabel(fader.value)} dB`}
          onChange={fader.onChange}
        />
      </div>
      <span className="screen mx-db" aria-hidden>
        {dbLabel(fader.value)}
        <small> dB</small>
      </span>
      <div className="keyset mx-keys">{children}</div>
    </section>
  );
}

/** A channel's mute or solo latch: a word where there is room, its letter where there isn't. */
function ChannelKey({
  role,
  track,
  on,
  toggle,
}: {
  role: "mute" | "solo";
  track: TrackData;
  on: boolean;
  toggle(): void;
}) {
  const Word = role === "mute" ? "Mute" : "Solo";
  return (
    <Key
      className="mx-btn"
      data-role={role}
      latched={on}
      aria-label={`${Word} ${track.label}`}
      title={Word}
      onClick={toggle}
    >
      <span className="mx-word">{role}</span>
      <span className="mx-short" aria-hidden>
        {Word[0]}
      </span>
    </Key>
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
