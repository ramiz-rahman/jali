/**
 * The audio engine and its transport: one playhead for the whole app. It lives outside the panes, so the sound goes
 * on whatever Jali does with them: a mixer folded into a tab, a tucked timeline or a maximised transcript changes
 * nothing here. Panes only read it (`position()`, the meters) while Jali says they are on screen.
 *
 * This file is the transport: the session in it, play, pause, seek, loop, speed and scrub, and the one clock they
 * move. The sound is made of three parts beside it:
 *  - graph.ts: a strip a track (fader, pan, meter) into the master, and the decoding of a session's files;
 *  - pitch.ts: the pitch shifter that keeps a faster speed at its own pitch;
 *  - grain.ts: the short grains a scrubbing hand hears.
 *
 * Every track is one continuous recording from time 0, so playing from a point starts each file at that offset.
 * Seeking, a new speed or a loop's restart stops every source and starts them again from there.
 *
 * Without Web Audio (tests, a browser that refuses it) the engine is a silent clock with the same API.
 */
import { createStore, type Store } from "@jali-examples/shared/store";
import { SILENCE_DB } from "../levels";
import type { Edits } from "../model/edits";
import { clamp } from "../numbers";
import type { SessionId } from "../sessions/ids";
import { loadSession, sessionById } from "../sessions/load";
import type { SegmentData, SessionData } from "../sessions/types";
import { GRAIN, playGrain } from "./grain";
import { createGraph, MissingTrack, type Decoded, type Graph } from "./graph";
import { createPitch, type Pitch } from "./pitch";

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export interface Loop {
  start: number;
  end: number;
  /** The segment it loops, when it came from one. */
  segment?: string;
}

export interface TransportState {
  /** The session in the transport. Its data is always loaded: the transport moves to a session once it is. */
  session: SessionId;
  /** Whether its audio is here: loading, ready, or failed (`missing` names the track that did not arrive). */
  status: "loading" | "ready" | "error";
  missing?: string;
  playing: boolean;
  rate: number;
  loop: Loop | null;
  /** Where the playhead was when the state last changed (a seek, a pause). The live one is `engine.position()`. */
  at: number;
}

export interface Engine extends Store<TransportState> {
  /** Whether sound comes out: false in tests and where Web Audio is missing. */
  readonly audio: boolean;
  position(): number;
  /** The data of the session in the transport. */
  session(): SessionData;
  /** Put `session` in the transport, paused at its start; its data and audio load first if they must. */
  load(session: SessionId): void;
  play(from?: number): void;
  pause(): void;
  toggle(): void;
  /** Pause, and go back to the loop's start, or the session's. */
  stop(): void;
  seek(time: number): void;
  /** Go to `time` in `session`, putting it in the transport first if it isn't (the seek waits for the load), and
   *  play from there if asked. */
  cue(session: SessionId, time: number, play?: boolean): void;
  /** Move the playhead by hand, as on a jog wheel: the sound follows the hand, forwards or backwards, at its own
   *  pitch. Once the hand rests, playback carries on from there if it was playing. */
  scrub(time: number): void;
  skip(seconds: number): void;
  setRate(rate: number): void;
  setLoop(loop: Loop | null): void;
  /** Loop `segment` of `session`, from its start; or stop, if it is the loop already. */
  toggleSegmentLoop(session: SessionId, segment: Pick<SegmentData, "id" | "start" | "end">): void;
  /** A meter's peak level now in dBFS: a track's by its id, or the master's (`MASTER_METERS`, graph.ts). Silence
   *  while stopped. */
  meter(id: string): number;
}

/** The sound, made on its first need: an audio context made before the person's first gesture would only wait. */
interface Sound {
  graph: Graph;
  pitch: Pitch;
}

/** A hand moving the playhead: where it last was, whether to play on once it rests, and the timer for that. */
interface Hand {
  pos: number;
  resume: boolean;
  rest: ReturnType<typeof setTimeout>;
}

export function createEngine({
  edits,
  session: first,
  audio = typeof AudioContext !== "undefined",
}: {
  edits: Edits;
  /** The session the transport starts on: its data must be loaded (`loadSession`). */
  session: SessionId;
  audio?: boolean;
}): Engine {
  if (!sessionById(first))
    throw new Error(`Load the session “${first}” before making the engine (loadSession).`);
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
  const session = () => sessionById(get().session)!;

  let sound: Sound | null = null;
  let refused = !audio;
  const decoded = new Map<SessionId, Decoded>();
  const decoding = new Map<SessionId, Promise<Decoded>>();
  let sources: AudioBufferSourceNode[] = [];
  let hand: Hand | null = null;
  let lastGrain = 0;
  /** The clock's time when the playhead left `at`. */
  let startedAt = 0;
  let watchdog: ReturnType<typeof setInterval> | 0 = 0;
  /** The session last asked for, so a slow load doesn't take the transport from a later choice. */
  let requested = first;

  const now = () => (sound ? sound.graph.ctx.currentTime : performance.now() / 1000);
  const inSession = (t: number) => clamp(t, 0, session().duration);

  function makeSound(): Sound | null {
    if (sound || refused) return sound;
    const graph = createGraph();
    if (!graph) {
      refused = true;
      return null;
    }
    const pitch = createPitch(graph.ctx, graph.master, () => {
      if (get().playing) restart(engine.position());
      else correctPitch();
    });
    graph.applyMix(session(), edits.of(get().session), true);
    return (sound = { graph, pitch });
  }

  const correctPitch = () => sound?.pitch.set(get().rate, hand !== null);

  edits.subscribe(() => sound?.graph.applyMix(session(), edits.of(get().session)));

  function stopSources() {
    sound?.pitch.shut();
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

  /** Every track from `pos` on, starting a moment from now. */
  function schedule(pos: number) {
    const tracks = decoded.get(get().session);
    if (!sound || !tracks) return;
    const { graph, pitch } = sound;
    const rate = get().rate;
    const t0 = graph.ctx.currentTime + 0.04;
    correctPitch();
    pitch.shut(t0);
    startedAt = t0;
    for (const [track, buffer] of tracks) {
      if (buffer.duration <= pos) continue;
      const src = graph.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(graph.input(track));
      src.start(t0, pos);
      sources.push(src);
    }
  }

  /** While playing: from `pos`, now. */
  function restart(pos: number) {
    stopSources();
    startedAt = now();
    set({ at: pos });
    if (sound) schedule(pos);
  }

  /** The hand is off the playhead: whether playback was to go on. */
  function letGo(): boolean {
    if (!hand) return false;
    clearTimeout(hand.rest);
    const resume = hand.resume;
    hand = null;
    return resume;
  }

  /** While playing: wrap at the loop's end, stop at the session's. */
  function startWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(() => {
      const { loop, playing } = get();
      if (!playing || hand) return;
      const pos = engine.position();
      if (loop && pos >= loop.end) restart(loop.start);
      else if (pos >= session().duration) {
        stopSources();
        stopWatchdog();
        set({ playing: false, at: session().duration });
      }
    }, 25);
  }
  function stopWatchdog() {
    if (watchdog) clearInterval(watchdog);
    watchdog = 0;
  }

  /** The audio of the session in the transport: here, or fetched and decoded once. */
  function fetchAudio(id: SessionId) {
    if (refused) return set({ status: "ready" });
    if (decoded.has(id)) return set({ status: "ready", missing: undefined });
    const graph = makeSound()?.graph;
    if (!graph) return set({ status: "ready" });
    set({ status: "loading", missing: undefined });
    let p = decoding.get(id);
    if (!p) {
      p = graph.decode(session());
      decoding.set(id, p);
    }
    p.then(
      (tracks) => {
        decoded.set(id, tracks);
        if (get().session === id) set({ status: "ready" });
      },
      (err: unknown) => {
        decoding.delete(id);
        const missing = err instanceof MissingTrack ? err.track : "A track";
        if (get().session === id) set({ status: "error", missing });
      },
    );
  }

  /** Run `go` once `id` is the transport's session and ready; never, if another session is asked for first. */
  function whenReady(id: SessionId, go: () => void) {
    const ready = () => get().session === id && get().status === "ready";
    if (!ready()) engine.load(id);
    if (ready()) return go();
    const stop = store.subscribe(() => {
      if (requested !== id || (get().session === id && get().status === "error")) return stop();
      if (ready()) {
        stop();
        go();
      }
    });
  }

  const engine: Engine = {
    ...store,
    audio,
    session,
    position() {
      const { playing, at, rate } = get();
      if (!playing || hand) return at;
      const heard = now() - startedAt - (sound?.pitch.lag() ?? 0);
      return inSession(at + Math.max(0, heard) * rate);
    },
    load(id) {
      requested = id;
      if (!sessionById(id)) {
        // Its data first; a failed load leaves the transport where it is (the panes say what failed).
        loadSession(id).then(
          () => requested === id && engine.load(id),
          () => {},
        );
        return;
      }
      if (id !== get().session) {
        engine.pause();
        set({ session: id, at: 0, loop: null });
        sound?.graph.applyMix(session(), edits.of(id), true);
      }
      fetchAudio(id);
    },
    play(from) {
      const s = get();
      if (s.status !== "ready") return;
      let pos = from ?? engine.position();
      if (pos >= session().duration - 0.05) pos = s.loop?.start ?? 0;
      letGo();
      stopSources();
      startedAt = now();
      set({ playing: true, at: pos });
      startWatchdog();
      const ctx = makeSound()?.graph.ctx;
      if (!ctx) return;
      // The context starts suspended until the person's first gesture; schedule once it runs, from where we are.
      void ctx.resume().then(() => {
        if (get().playing && !sources.length) schedule(get().at);
      });
      if (ctx.state === "running") schedule(pos);
    },
    pause() {
      letGo();
      if (!get().playing) return;
      const pos = engine.position();
      stopSources();
      stopWatchdog();
      set({ playing: false, at: pos });
    },
    toggle: () => (get().playing ? engine.pause() : engine.play()),
    stop() {
      engine.pause();
      engine.seek(get().loop?.start ?? 0);
    },
    seek(time) {
      const pos = inSession(time);
      letGo();
      if (get().playing) restart(pos);
      else set({ at: pos });
    },
    cue(id, time, play = false) {
      whenReady(id, () => {
        engine.seek(time);
        if (play) engine.play(time);
      });
    },
    scrub(time) {
      const pos = inSession(time);
      const ctx = makeSound()?.graph.ctx;
      if (ctx && ctx.state !== "running") void ctx.resume();
      const first = !hand;
      const resume = hand ? hand.resume : get().playing;
      const moved = pos - (hand ? hand.pos : get().at);
      if (hand) clearTimeout(hand.rest);
      else stopSources();
      hand = {
        pos,
        resume,
        rest: setTimeout(() => {
          if (letGo() && get().playing) restart(get().at);
        }, 180),
      };
      if (first) correctPitch();
      set({ at: pos });
      const clock = performance.now() / 1000;
      const tracks = decoded.get(get().session);
      if (moved && sound && tracks && clock - lastGrain >= GRAIN / 2) {
        lastGrain = clock;
        playGrain(sound.graph, tracks, pos, moved < 0);
      }
    },
    skip: (seconds) => engine.seek(engine.position() + seconds),
    setRate(rate) {
      const pos = engine.position();
      set({ rate });
      if (get().playing) restart(pos);
      else correctPitch();
    },
    setLoop(loop) {
      set({ loop });
      if (!loop) return;
      const pos = engine.position();
      if (pos < loop.start || pos >= loop.end) engine.seek(loop.start);
    },
    toggleSegmentLoop(id, { id: segment, start, end }) {
      if (get().session === id && get().loop?.segment === segment) return engine.setLoop(null);
      whenReady(id, () => {
        engine.seek(start);
        engine.setLoop({ start, end, segment });
      });
    },
    meter: (id) => (sound && get().playing ? sound.graph.meter(id) : SILENCE_DB),
  };

  return engine;
}
