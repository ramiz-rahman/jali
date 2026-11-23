/**
 * An instance's lifetime: what outlives a single commit and must end with the instance. Three kinds of thing wait on
 * it: a host's answer still pending (they listen to `signal`), deferred steps (timers, by key), and gestures in
 * progress (a pane or divider drag, with listeners on the window). `end()` ends all three, once; `cancelGestures()`
 * ends only the gestures, for a stop that may be followed by a start.
 *
 * Each gesture registers how to cancel itself and gets back its release: the gesture calls the release when it ends
 * on its own (a drop, Escape), and the lifetime calls the cancel when the instance stops first. Either way the
 * gesture's cleanup runs exactly once.
 */
export interface Lifetime {
  /** Aborted when the instance ends. */
  readonly signal: AbortSignal;
  /** Whether `end()` has run. */
  ended(): boolean;
  /** Run `run` after `ms`, replacing any step waiting under `key`; without `run`, cancel it. Nothing once ended. */
  defer(key: string, ms: number, run?: () => void): void;
  /** A gesture started: `cancel` ends it (removes its listeners, restores what it previewed). Returns the release the
   *  gesture calls when it ends on its own. Once ended, `cancel` runs at once. */
  gesture(cancel: () => void): () => void;
  /** Cancel every gesture in progress. */
  cancelGestures(): void;
  /** Whether a gesture is in progress. Gestures nest (a pane drag that edge-scrolls is two). */
  gesturing(): boolean;
  /** End the lifetime: abort the signal first, so whatever ends with it finds it ended, then cancel the gestures and
   *  drop the deferred steps. Again does nothing. */
  end(): void;
}

/** `busy`: called when a gesture starts with none in progress; `idle`: when the last one ends, however it ends. */
export function createLifetime(busy?: () => void, idle?: () => void): Lifetime {
  const life = new AbortController();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const gestures = new Set<() => void>();
  // Each cancel takes itself out of the set; a Set's iteration allows that.
  const cancelGestures = () => {
    for (const cancel of gestures) cancel();
  };
  return {
    signal: life.signal,
    ended: () => life.signal.aborted,
    defer(key, ms, run) {
      clearTimeout(timers.get(key));
      timers.delete(key);
      if (!run || life.signal.aborted) return;
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          run();
        }, ms),
      );
    },
    gesture(cancel) {
      if (life.signal.aborted) {
        cancel();
        return () => {};
      }
      let live = true;
      const end = (cancelIt: boolean) => {
        if (!live) return;
        live = false;
        gestures.delete(stop);
        if (cancelIt) cancel();
        if (!gestures.size) idle?.();
      };
      const stop = () => end(true);
      if (!gestures.size) busy?.();
      gestures.add(stop);
      return () => end(false);
    },
    cancelGestures,
    gesturing: () => gestures.size > 0,
    end() {
      if (life.signal.aborted) return;
      life.abort();
      cancelGestures();
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}
