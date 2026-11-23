/**
 * The audio graph: one strip a track (the track's sources → gain for the fader, mute and solo → pan → analyser for its
 * meter → master), the master into the speakers, and a meter on each side of the master. It knows nothing of the
 * transport: the engine (engine.ts) starts and stops the sources, this is where they play.
 *
 * A strip is a track's place on the desk, made the first time the track is played or mixed, and kept: moving back to
 * a session finds its strips where they were.
 */
import { dbToGain, gainToDb, SILENCE_DB } from "../levels";
import type { SessionEdits } from "../model/edits";
import { audible, channelOf } from "../model/mix";
import type { SessionData } from "../sessions/types";

/** What the master's meters are called beside the tracks' (a track's meter is its id). */
export const MASTER_METERS = { left: "master-l", right: "master-r" } as const;

/** A session's decoded tracks, by track id. */
export type Decoded = Map<string, AudioBuffer>;

interface Strip {
  gain: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
}

export interface Graph {
  readonly ctx: AudioContext;
  /** The sum of every strip, before the speakers (or the pitch shifter, pitch.ts). */
  readonly master: GainNode;
  /** Where a track's sources connect: its strip's input. */
  input(track: string): AudioNode;
  /** A session's faders, pans, mutes and solos onto its strips; `immediate` jumps, else they glide (no clicks). */
  applyMix(session: SessionData, edits: SessionEdits, immediate?: boolean): void;
  /** A meter's peak level now in dBFS (`SILENCE_DB` for silence). Read every frame, so it allocates nothing. */
  meter(id: string): number;
  /** Every track of `session`, fetched and decoded. A failure names the track that did not arrive. */
  decode(session: SessionData): Promise<Decoded>;
}

/** The graph, on an audio context of its own; `null` where Web Audio is refused. */
export function createGraph(): Graph | null {
  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ latencyHint: "playback" });
  } catch {
    return null;
  }
  const master = ctx.createGain();
  const split = ctx.createChannelSplitter(2);
  const sides = { left: ctx.createAnalyser(), right: ctx.createAnalyser() };
  master.connect(ctx.destination);
  master.connect(split);
  split.connect(sides.left, 0);
  split.connect(sides.right, 1);

  const strips = new Map<string, Strip>();
  const strip = (track: string): Strip => {
    let s = strips.get(track);
    if (s) return s;
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    gain.connect(pan).connect(analyser).connect(master);
    strips.set(track, (s = { gain, pan, analyser }));
    return s;
  };

  const analysers = new Map<string, AnalyserNode>([
    [MASTER_METERS.left, sides.left],
    [MASTER_METERS.right, sides.right],
  ]);
  /** Each analyser's sample buffer, made once. */
  const samples = new WeakMap<AnalyserNode, Float32Array<ArrayBuffer>>();

  return {
    ctx,
    master,
    input: (track) => strip(track).gain,
    applyMix(session, edits, immediate = false) {
      const at = ctx.currentTime;
      const to = (p: AudioParam, v: number) =>
        immediate ? p.setValueAtTime(v, at) : p.setTargetAtTime(v, at, 0.015);
      for (const t of session.tracks) {
        const s = strip(t.id);
        const ch = channelOf(session.id, edits.mix, t.id);
        const heard = audible(session.id, edits.mix, t.id, session.tracks);
        to(s.gain.gain, heard ? dbToGain(ch.gain) : 0);
        to(s.pan.pan, ch.pan);
      }
      to(master.gain, dbToGain(edits.masterGain));
    },
    meter(id) {
      const a = analysers.get(id) ?? strips.get(id)?.analyser;
      if (!a) return SILENCE_DB;
      let buf = samples.get(a);
      if (buf?.length !== a.fftSize) samples.set(a, (buf = new Float32Array(a.fftSize)));
      a.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]!));
      return gainToDb(peak);
    },
    async decode(session) {
      const one = async (url: string) => {
        const res = await fetch(new URL(url, document.baseURI));
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return ctx.decodeAudioData(await res.arrayBuffer());
      };
      const buffers = await Promise.all(
        session.tracks.map(async (t) => {
          try {
            return [t.id, await one(t.file)] as const;
          } catch {
            throw new MissingTrack(t.label);
          }
        }),
      );
      return new Map(buffers);
    },
  };
}

/** A track whose audio did not arrive: its label is what the person is told. */
export class MissingTrack extends Error {
  constructor(readonly track: string) {
    super(`The audio of “${track}” did not arrive.`);
  }
}
