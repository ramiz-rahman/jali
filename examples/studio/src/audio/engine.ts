/**
 * The audio engine and its transport: one playhead for the whole app. It lives outside the panes, so the sound goes
 * on whatever Jali does with them: a mixer folded into a tab, a tucked timeline or a maximised transcript changes
 * nothing here. Panes only read it (`position()`, the meters) while Jali says they are on screen.
 *
 * The graph, one strip a track of the session in the transport: the track's file → gain (fader, mute, solo) → pan →
 * analyser (the meter) → master → speakers. Every track is one continuous recording from time 0, so playing from a
 * point starts each file at that offset. Seeking, a new speed or a loop's restart stops every source and starts
 * them again from there. A session with another set of tracks gets its own strips when it is loaded.
 *
 * Speed plays the files faster, which on its own raises their pitch like a record spun fast. So at any speed but 1×
 * the master goes through a pitch shifter that puts the pitch back: master → shifter → gate → speakers. The shifter
 * holds the sound for a moment (`lag`), so the playhead waits that long too, and the gate shuts while what is left
 * inside it from before a seek or a pause drains.
 *
 * Scrubbing is heard: each move of the hand plays a short grain of every track from where the playhead now is,
 * backwards when the hand moves back (a grain played backwards is a reversed copy of its samples). Grains overlap,
 * so a steady turn is a steady sound. Every grain plays as recorded, so the pitch stays put however fast the hand
 * moves: a fast turn skips more between grains. They skip the shifter, which has nothing to put back.
 *
 * Without Web Audio (tests, a browser that refuses it) the engine is a silent clock with the same API.
 */
import { audible, channelOf, type Edits } from "../edits";
import { sessionById, type SessionData } from "../sessions/sessions";
import { catalogueOf } from "../sessions/catalog";
import { createStore, type Store } from "../store";
import type { StretchNode } from "signalsmith-stretch";

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export interface Loop {
  start: number;
  end: number;
  /** The segment it loops, when it came from one. */
  segment?: string;
}

export interface TransportState {
  /** The session in the transport. */
  session: string;
  status: "loading" | "ready" | "error";
  playing: boolean;
  rate: number;
  loop: Loop | null;
  /** The position when the state last changed (a seek, a pause). The live one is `engine.position()`. */
  at: number;
  error?: string;
}

export interface Meter {
  /** dBFS, -60 for silence. */
  rms: number;
  peak: number;
}

export interface Engine extends Store<TransportState> {
  /** Whether sound comes out: false in tests and where Web Audio is missing. */
  readonly audio: boolean;
  position(): number;
  session(): SessionData;
  load(session: string): void;
  play(from?: number): void;
  pause(): void;
  toggle(): void;
  seek(time: number): void;
  /**
   * Move the playhead by hand, as on a jog wheel: the sound follows the hand, forwards or backwards, at its own
   * pitch. Once the hand rests, playback carries on from there if it was playing.
   */
  scrub(time: number): void;
  skip(seconds: number): void;
  setRate(rate: number): void;
  setLoop(loop: Loop | null): void;
  /** A track's level now, or the master's ("master-l", "master-r"). Read only by a mixer on screen. The reading
   *  is the track's own object, updated in place by the next call: read it, don't keep it. */
  meter(track: string): Readonly<Meter>;
}

const SILENT: Meter = { rms: -60, peak: -60 };
const dbToGain = (db: number) => (db <= -60 ? 0 : 10 ** (db / 20));
const toDb = (v: number) => (v <= 0.001 ? -60 : Math.max(-60, 20 * Math.log10(v)));

/** A session's decoded tracks, by track id. */
type Loaded = Map<string, AudioBuffer>;

interface Strip {
  gain: GainNode;
  pan: StereoPannerNode;
  analyser: AnalyserNode;
}

export function createEngine({
  edits,
  session: first,
  audio = typeof AudioContext !== "undefined",
}: {
  edits: Edits;
  session: string;
  audio?: boolean;
}): Engine {
  const store = createStore<TransportState>({
    session: first,
    status: audio ? "loading" : "ready",
    playing: false,
    rate: 1,
    loop: null,
    at: 0,
  });
  const get = () => store.get();
  const set = (patch: Partial<TransportState>) => store.set((s) => ({ ...s, ...patch }));

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let masterL: AnalyserNode | null = null;
  let masterR: AnalyserNode | null = null;
  const strips = new Map<string, Strip>();
  const loaded = new Map<string, Loaded>();
  const loading = new Map<string, Promise<void>>();
  const readings = new WeakMap<AnalyserNode, { buf: Float32Array<ArrayBuffer>; meter: Meter }>();
  let sources: AudioBufferSourceNode[] = [];
  let shifter: StretchNode | null = null;
  let gate: GainNode | null = null;
  let shifterAsked = false;
  /** The master is going through the shifter. */
  let shifting = false;
  /** Seconds the shifter holds the sound. */
  let lag = 0;
  /** A hand is moving the playhead: where it last was, and whether to play on once it rests. */
  let hand: { pos: number; resume: boolean; rest: ReturnType<typeof setTimeout> } | null = null;
  let lastGrain = 0;
  let anchorPos = 0;
  let anchorTime = 0;
  let watchdog: ReturnType<typeof setInterval> | 0 = 0;

  const now = () => (ctx ? ctx.currentTime : performance.now() / 1000);
  const session = () => sessionById(get().session)!;

  function graph(): AudioContext | null {
    if (ctx || !audio) return ctx;
    try {
      ctx = new AudioContext({ latencyHint: "playback" });
    } catch {
      return null;
    }
    master = ctx.createGain();
    const split = ctx.createChannelSplitter(2);
    masterL = ctx.createAnalyser();
    masterR = ctx.createAnalyser();
    master.connect(ctx.destination);
    master.connect(split);
    split.connect(masterL, 0);
    split.connect(masterR, 1);
    stripsFor(session());
    applyMix(true);
    return ctx;
  }

  /** A strip for each of the session's tracks that has none yet. Track ids are unique across the library. */
  function stripsFor(s: SessionData) {
    if (!ctx || !master) return;
    for (const t of s.tracks) {
      if (strips.has(t.id)) continue;
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      gain.connect(pan).connect(analyser).connect(master);
      strips.set(t.id, { gain, pan, analyser });
    }
  }

  /** The faders, pans, mutes and solos of the session in the transport, onto the graph. */
  function applyMix(immediate = false) {
    if (!ctx || !master) return;
    const e = edits.of(get().session);
    const at = ctx.currentTime;
    const to = (p: AudioParam, v: number) =>
      immediate ? p.setValueAtTime(v, at) : p.setTargetAtTime(v, at, 0.015);
    const tracks = session().tracks;
    stripsFor(session());
    for (const t of tracks) {
      const s = strips.get(t.id)!;
      const ch = channelOf(e, t.id);
      to(s.gain.gain, audible(e, t.id, tracks) ? dbToGain(ch.gain) : 0);
      to(s.pan.pan, ch.pan);
    }
    to(master.gain, dbToGain(e.masterGain));
  }
  edits.subscribe(() => applyMix());

  async function fetchSession(id: string): Promise<void> {
    const s = sessionById(id);
    const c = graph();
    if (!s || !c) return;
    const decode = async (url: string) => {
      const res = await fetch(new URL(url, document.baseURI));
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return c.decodeAudioData(await res.arrayBuffer());
    };
    // A failure names the track, so the message can say what did not arrive.
    const buffers = await Promise.all(
      s.tracks.map(async (t) => {
        try {
          return [t.id, await decode(t.file)] as const;
        } catch {
          throw new Error(t.label);
        }
      }),
    );
    loaded.set(id, new Map(buffers));
  }

  /** The pitch back where it was at this speed. The shifter is fetched the first time a speed needs it. */
  function pitch() {
    const c = ctx;
    if (!c || !master) return;
    const rate = get().rate;
    if (rate !== 1 && !shifterAsked) {
      shifterAsked = true;
      import("signalsmith-stretch")
        .then(async ({ default: create }) => {
          const node = await create(c);
          const out = c.createGain();
          node.connect(out).connect(c.destination);
          lag = await node.latency();
          shifter = node;
          gate = out;
          if (get().playing) restart(engine.position());
          else pitch();
        })
        .catch(() => {
          // no worklet here: speed keeps its raised pitch
        });
    }
    const on = rate !== 1 && !!shifter && !hand;
    if (on !== shifting) {
      master.disconnect(on ? c.destination : shifter!);
      master.connect(on ? shifter! : c.destination);
      shifting = on;
    }
    if (on) void shifter!.schedule({ active: true, semitones: -12 * Math.log2(rate) });
  }

  /** Shut now; open again when sound that goes into the shifter at `from` comes out of it. */
  function shut(from?: number) {
    if (!ctx || !gate) return;
    const g = gate.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(0, ctx.currentTime);
    if (from !== undefined) g.setTargetAtTime(1, from + lag - 0.01, 0.004);
  }

  function stopSources() {
    shut();
    for (const src of sources) {
      try {
        src.stop();
      } catch {
        // never started
      }
      src.disconnect();
    }
    sources = [];
  }

  /** Every source from `pos` on, starting a moment from now. */
  function schedule(pos: number) {
    const c = ctx;
    const data = loaded.get(get().session);
    if (!c || !data) return;
    const s = session();
    const rate = get().rate;
    const t0 = c.currentTime + 0.04;
    pitch();
    shut(t0);
    anchorPos = pos;
    anchorTime = t0;
    const place = (buffer: AudioBuffer, at: number, track: string) => {
      const end = at + buffer.duration;
      if (end <= pos) return;
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(strips.get(track)!.gain);
      src.start(t0 + Math.max(0, at - pos) / rate, Math.max(0, pos - at));
      sources.push(src);
    };
    stripsFor(s);
    for (const t of s.tracks) {
      const buffer = data.get(t.id);
      if (buffer) place(buffer, 0, t.id);
    }
  }

  const GRAIN = 0.09;
  /** A grain of every track at `pos`, as recorded, backwards if `back`. */
  function grain(pos: number, back: boolean) {
    const c = ctx;
    const data = loaded.get(get().session);
    if (!c || !data || c.state !== "running") return;
    const t = c.currentTime + 0.005;
    const span = GRAIN;
    for (const [track, buffer] of data) {
      const strip = strips.get(track);
      const from = back ? pos - span : pos;
      if (!strip || from < 0 || from + span > buffer.duration) continue;
      const src = c.createBufferSource();
      if (back) {
        const n = Math.floor(span * buffer.sampleRate);
        const start = Math.floor(from * buffer.sampleRate);
        const rev = c.createBuffer(buffer.numberOfChannels, n, buffer.sampleRate);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++)
          rev.getChannelData(ch).set(
            buffer
              .getChannelData(ch)
              .subarray(start, start + n)
              .reverse(),
          );
        src.buffer = rev;
      } else src.buffer = buffer;
      const env = c.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.8, t + 0.02);
      env.gain.setValueAtTime(0.8, t + GRAIN - 0.03);
      env.gain.linearRampToValueAtTime(0, t + GRAIN);
      src.connect(env).connect(strip.gain);
      if (back) src.start(t);
      else src.start(t, from, span);
      src.stop(t + GRAIN);
      src.onended = () => env.disconnect();
    }
  }

  /** The hand is off the playhead. */
  function letGo() {
    if (!hand) return false;
    clearTimeout(hand.rest);
    const resume = hand.resume;
    hand = null;
    return resume;
  }

  function startWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(() => {
      const { loop, playing } = get();
      if (!playing || hand) return;
      const pos = engine.position();
      if (loop && pos >= loop.end) restart(loop.start);
      else if (pos >= session().duration) {
        stopSources();
        anchorPos = session().duration;
        set({ playing: false, at: anchorPos });
        stopWatchdog();
      }
    }, 25);
  }
  function stopWatchdog() {
    if (watchdog) clearInterval(watchdog);
    watchdog = 0;
  }

  /** While playing: from `pos`, now. */
  function restart(pos: number) {
    stopSources();
    anchorPos = pos;
    anchorTime = now();
    if (ctx) schedule(pos);
    set({ at: pos });
  }

  const clamp = (t: number) => Math.max(0, Math.min(session().duration, t));

  const engine: Engine = {
    ...store,
    audio,
    session,
    position() {
      if (!get().playing || hand) return anchorPos;
      const heard = now() - anchorTime - (shifting ? lag : 0);
      return clamp(anchorPos + Math.max(0, heard) * get().rate);
    },
    load(id) {
      if (!sessionById(id)) return;
      if (id !== get().session) {
        engine.pause();
        anchorPos = 0;
        set({ session: id, at: 0, loop: null });
        applyMix(true);
      }
      if (!audio) return set({ status: "ready" });
      if (loaded.has(id)) return set({ status: "ready", error: undefined });
      set({ status: "loading", error: undefined });
      let p = loading.get(id);
      if (!p) {
        p = fetchSession(id);
        loading.set(id, p);
      }
      p.then(
        () => {
          if (get().session === id) set({ status: loaded.has(id) ? "ready" : "error" });
        },
        (err: unknown) => {
          loading.delete(id);
          if (get().session === id) set({ status: "error", error: String(err) });
        },
      );
    },
    play(from) {
      const s = get();
      if (s.status !== "ready") return;
      let pos = from ?? engine.position();
      if (pos >= session().duration - 0.05) pos = s.loop?.start ?? 0;
      letGo();
      stopSources();
      anchorPos = pos;
      anchorTime = now();
      set({ playing: true, at: pos });
      startWatchdog();
      const c = graph();
      if (!c) return;
      // The context starts suspended until the person's first gesture; schedule once it runs, from where we are.
      void c.resume().then(() => {
        if (get().playing && !sources.length) schedule(anchorPos);
      });
      if (c.state === "running") schedule(pos);
    },
    pause() {
      letGo();
      if (!get().playing) return;
      const pos = engine.position();
      stopSources();
      stopWatchdog();
      anchorPos = pos;
      set({ playing: false, at: pos });
    },
    toggle: () => (get().playing ? engine.pause() : engine.play()),
    seek(time) {
      const pos = clamp(time);
      letGo();
      if (get().playing) restart(pos);
      else {
        anchorPos = pos;
        set({ at: pos });
      }
    },
    scrub(time) {
      const pos = clamp(time);
      const c = graph();
      if (c && c.state !== "running") void c.resume();
      const at = performance.now() / 1000;
      const resume = hand ? hand.resume : get().playing;
      const moved = pos - (hand ? hand.pos : anchorPos);
      if (hand) clearTimeout(hand.rest);
      else {
        stopSources();
        hand = { pos, resume, rest: 0 as never };
        pitch();
      }
      hand.pos = pos;
      hand.rest = setTimeout(() => {
        if (letGo() && get().playing) restart(anchorPos);
      }, 180);
      anchorPos = pos;
      set({ at: pos });
      if (moved && at - lastGrain >= GRAIN / 2) {
        lastGrain = at;
        grain(pos, moved < 0);
      }
    },
    skip: (seconds) => engine.seek(engine.position() + seconds),
    setRate(rate) {
      const pos = engine.position();
      set({ rate });
      if (get().playing) restart(pos);
      else pitch();
    },
    setLoop(loop) {
      set({ loop });
      if (loop) {
        const pos = engine.position();
        if (pos < loop.start || pos >= loop.end) engine.seek(loop.start);
      }
    },
    meter(track) {
      const a =
        track === "master-l"
          ? masterL
          : track === "master-r"
            ? masterR
            : (strips.get(track)?.analyser ?? null);
      if (!a || !get().playing) return SILENT;
      // Read every frame for every strip: each analyser keeps its own buffer and reading, so a frame allocates nothing.
      let r = readings.get(a);
      if (r?.buf.length !== a.fftSize)
        readings.set(a, (r = { buf: new Float32Array(a.fftSize), meter: { rms: -60, peak: -60 } }));
      const { buf, meter } = r;
      a.getFloatTimeDomainData(buf);
      let peak = 0;
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] ?? 0;
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      meter.rms = toDb(Math.sqrt(sum / buf.length));
      meter.peak = toDb(peak);
      return meter;
    },
  };

  mediaKeys(engine);
  return engine;
}

/** The keyboard's and the system's media keys play and pause too. */
function mediaKeys(engine: Engine) {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
  if (!ms) return;
  try {
    ms.setActionHandler("play", () => engine.play());
    ms.setActionHandler("pause", () => engine.pause());
    ms.setActionHandler("seekbackward", () => engine.skip(-5));
    ms.setActionHandler("seekforward", () => engine.skip(5));
  } catch {
    // a browser without these actions
  }
  engine.subscribe(() => {
    const s = engine.session();
    ms.playbackState = engine.get().playing ? "playing" : "paused";
    if (ms.metadata?.title !== s.title && typeof MediaMetadata !== "undefined")
      ms.metadata = new MediaMetadata({
        title: s.title,
        artist: catalogueOf(s).source,
        album: "Studio",
      });
  });
}
