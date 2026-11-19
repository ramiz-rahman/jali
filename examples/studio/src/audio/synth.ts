/**
 * The music: a bed and a sting for each session, synthesised with the Web Audio API in an OfflineAudioContext when the
 * session loads. No samples, no files, no licences. The bed ducks under the voices by itself (its own gain follows
 * the speech), as a mixed podcast's bed would.
 */
import type { SessionData } from "../sessions/types";

/** The music renders at this rate: a soft pad needs no more, and it renders twice as fast as at 44.1 kHz. */
export const MUSIC_RATE = 22050;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Chords as semitones above the key's root, two bars each. */
const PROGRESSIONS: Record<SessionData["music"]["colour"], number[][]> = {
  // i, VI, III, VII in a minor key
  warm: [
    [0, 3, 7, 10],
    [-4, 0, 3, 7],
    [3, 7, 10, 14],
    [-2, 2, 5, 9],
  ],
  // I, vi, IV, V in a major key
  bright: [
    [0, 4, 7, 11],
    [-3, 0, 4, 7],
    [-7, -3, 0, 4],
    [-5, -1, 2, 5],
  ],
  // i, VI, i, v: slow and low
  dark: [
    [0, 3, 7, 14],
    [-4, 0, 3, 10],
    [0, 3, 7, 12],
    [-5, -2, 2, 7],
  ],
};

/** The bed's level over time: up in the intro and outro, down under the voices. */
function duck(gain: GainNode, s: SessionData) {
  const g = gain.gain;
  const first = s.segments[0]!.start;
  const last = s.segments.at(-1)!.end;
  g.setValueAtTime(0, 0);
  g.linearRampToValueAtTime(0.9, 0.6);
  g.setValueAtTime(0.9, first - 0.9);
  g.linearRampToValueAtTime(0.2, first - 0.1);
  g.setValueAtTime(0.2, last + 0.1);
  g.linearRampToValueAtTime(0.9, last + 0.9);
  g.setValueAtTime(0.9, s.duration - 2.2);
  g.linearRampToValueAtTime(0, s.duration - 0.05);
}

export async function renderBed(s: SessionData): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(s.duration * MUSIC_RATE), MUSIC_RATE);
  const { root, tempo, colour } = s.music;
  const beat = 60 / tempo;
  const chordLength = beat * 8;
  const chords = PROGRESSIONS[colour];

  const master = ctx.createGain();
  duck(master, s);
  // A gentle low-pass on everything: a bed sits behind the voices, never in front.
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = colour === "bright" ? 3200 : 2200;
  master.connect(tone).connect(ctx.destination);

  const voice = (
    type: OscillatorType,
    freq: number,
    at: number,
    length: number,
    level: number,
    pan: number,
    attack: number,
    release: number,
    detune = 0,
  ) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + attack);
    g.gain.setValueAtTime(level, Math.max(at + attack, at + length - release));
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(g).connect(p).connect(master);
    o.start(at);
    o.stop(at + length + 0.05);
  };

  // The pad: each chord's notes on two detuned oscillators, spread across the stereo field.
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = colour === "dark" ? 700 : 1100;
  padFilter.Q.value = 0.7;
  padFilter.connect(master);
  for (let at = 0, n = 0; at < s.duration; at += chordLength, n++) {
    const chord = chords[n % chords.length]!;
    const length = Math.min(chordLength + 1.2, s.duration - at);
    chord.forEach((step, i) => {
      const f = hz(root + step);
      const pan = (i / (chord.length - 1)) * 1.2 - 0.6;
      for (const [type, detune] of [
        ["sawtooth", -7],
        ["triangle", 6],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        const level = type === "sawtooth" ? 0.018 : 0.035;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(level, at + 1.1);
        g.gain.setValueAtTime(level, at + length - 1.2);
        g.gain.linearRampToValueAtTime(0, at + length);
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        o.connect(g).connect(p).connect(padFilter);
        o.start(at);
        o.stop(at + length + 0.05);
      }
    });
    // The bass: the chord's root, an octave and a half down.
    voice("sine", hz(root + chord[0]! - 24), at, length, 0.09, 0, 0.3, 1.0);
    // The arpeggio: a soft pluck on eighth notes, the chord's notes an octave up.
    const pattern = colour === "dark" ? [0, 2, 1, 3] : [0, 1, 2, 3, 2, 1, 3, 1];
    const step = colour === "dark" ? beat : beat / 2;
    for (let k = 0; at + k * step < Math.min(at + chordLength, s.duration - 1); k++) {
      const note = chord[pattern[k % pattern.length]!]! + 12;
      const t = at + k * step;
      voice("sine", hz(root + note), t, 0.5, 0.05, k % 2 ? 0.35 : -0.35, 0.005, 0.45);
      voice("triangle", hz(root + note + 12), t, 0.25, 0.012, k % 2 ? 0.35 : -0.35, 0.005, 0.2);
    }
  }
  return ctx.startRendering();
}

/** The sting: a rising bell arpeggio over a filtered swell of noise, about two and a half seconds. */
export async function renderSting(s: SessionData): Promise<AudioBuffer> {
  const length = 2.6;
  const ctx = new OfflineAudioContext(2, Math.ceil(length * MUSIC_RATE), MUSIC_RATE);
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(ctx.destination);

  // The swell: white noise through a band-pass that sweeps up.
  const noise = ctx.createBuffer(1, Math.ceil(1.2 * MUSIC_RATE), MUSIC_RATE);
  const data = noise.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(400, 0);
  band.frequency.exponentialRampToValueAtTime(5000, 1.1);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, 0);
  ng.gain.linearRampToValueAtTime(0.12, 0.9);
  ng.gain.linearRampToValueAtTime(0, 1.2);
  src.connect(band).connect(ng).connect(out);
  src.start(0);

  // The bells: a sine and two inharmonic partials, each note a little later and higher.
  const root = s.music.root + 12;
  const notes = s.music.colour === "bright" ? [0, 4, 7, 12, 16] : [0, 3, 7, 10, 15];
  notes.forEach((step, i) => {
    const at = 0.55 + i * 0.12;
    const f = hz(root + step);
    for (const [ratio, level] of [
      [1, 0.16],
      [2.76, 0.04],
      [5.4, 0.015],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(level, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6 / ratio ** 0.4);
      const p = ctx.createStereoPanner();
      p.pan.value = (i - 2) * 0.25;
      o.connect(g).connect(p).connect(out);
      o.start(at);
      o.stop(at + 2);
    }
  });
  return ctx.startRendering();
}

/** The loudest sample in each window of `1 / perSecond` seconds, across channels: what the waveforms draw. */
export function peaksOf(buffer: AudioBuffer, perSecond = 50): Float32Array {
  const win = Math.max(1, Math.round(buffer.sampleRate / perSecond));
  const out = new Float32Array(Math.ceil(buffer.length / win));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]!);
      const k = (i / win) | 0;
      if (v > out[k]!) out[k] = v;
    }
  }
  return out;
}
