/** The tour's time: waits that pause and resume with the tour, and all reject at once when it stops. */
/** What a tour step's wait rejects with when the tour stops: the step ends there, and nothing after it runs. */
export class Stopped extends Error {}

/** Timers a tour waits on: paused and resumed with it, and rejected when it stops. */
export function createClock() {
  let paused = false,
    dead = false;
  let pending: {
    resolve(): void;
    reject(e: Error): void;
    left: number;
    at: number;
    timer?: ReturnType<typeof setTimeout>;
  } | null = null;
  const arm = () => {
    const p = pending;
    if (!p || paused) return;
    p.at = performance.now();
    p.timer = setTimeout(() => {
      if (pending === p) pending = null;
      p.resolve();
    }, p.left);
  };
  return {
    wait: (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (dead) return reject(new Stopped());
        pending = { resolve, reject, left: Math.max(0, ms), at: 0 };
        arm();
      }),
    pause() {
      if (paused) return;
      paused = true;
      if (pending?.timer !== undefined) {
        clearTimeout(pending.timer);
        pending.timer = undefined;
        pending.left -= performance.now() - pending.at;
      }
    },
    resume() {
      if (!paused) return;
      paused = false;
      arm();
    },
    stop() {
      dead = true;
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(new Stopped());
        pending = null;
      }
    },
    get dead() {
      return dead;
    },
  };
}
export type Clock = ReturnType<typeof createClock>;
