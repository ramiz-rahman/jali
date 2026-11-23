/**
 * The feel of the controls, in sound: a key clacks down and up, a fader and a pan dial tick as they move and thud
 * softly at their centre and their ends, and the speed selector clunks into each detent. The sounds are made here
 * (a burst of noise through a filter, a short low thump), not played from files, on an audio context of their own,
 * so they never reach the mixer's meters or the session's sound.
 *
 * Two ways in:
 *  - Keys: `installFeel` listens to the whole page for a press on anything that is a key (a button, a tab, a row
 *    that selects), so Jali's own buttons and tabs sound too, with nothing in them calling this.
 *  - Sliders: each control calls `feelSlide` from its own change, the one place that knows where its steps, detents
 *    and ends are. A slider moved by playback (the scrub dial's clock) never calls it, so it stays quiet. The jog dial
 *    and the timeline are heard through the session's own audio as they scrub, so they don't tick either.
 *
 * The person turns the sounds off and on (`setFeelSounds`, from the settings). A phone that can vibrate gives a short
 * tap with a key and a detent as well.
 */

/** Anything that is pressed like a key: Jali's controls by their roles, and the design system's own `.key`. */
const KEYS =
  'button, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="switch"], .key';

let enabled = true;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof AudioContext === "undefined") return null;
  try {
    ctx = new AudioContext({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.destination);
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** A burst of filtered noise: the contact. */
function burst(c: AudioContext, at: number, hz: number, q: number, ms: number, level: number) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = hz;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  src.connect(f).connect(g).connect(out!);
  src.start(at, Math.random() * 0.02, ms / 1000 + 0.01);
}

/** A short falling sine: the body the contact lands on. */
function thump(c: AudioContext, at: number, from: number, to: number, ms: number, level: number) {
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + ms / 1000);
  const g = c.createGain();
  g.gain.setValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  osc.connect(g).connect(out!);
  osc.start(at);
  osc.stop(at + ms / 1000 + 0.01);
}

type Sound = "down" | "up" | "tick" | "detent" | "stop";

/** Each sound as its parts, for a key of `weight` (1 an ordinary key; more is bigger, lower and fuller). */
const SOUNDS: Record<Sound, (c: AudioContext, t: number, weight: number) => void> = {
  down: (c, t, w) => {
    burst(c, t, 2600 / w, 1.2, 14, 0.5);
    thump(c, t, 190 / w, 90 / w, 38, 0.32 * w);
  },
  up: (c, t, w) => {
    burst(c, t, 3800 / w, 1.4, 9, 0.24);
    thump(c, t, 260 / w, 170 / w, 18, 0.1);
  },
  tick: (c, t) => burst(c, t, 5200, 2.5, 4, 0.16),
  detent: (c, t) => {
    burst(c, t, 3200, 1.6, 9, 0.4);
    thump(c, t, 320, 180, 24, 0.22);
  },
  stop: (c, t) => {
    burst(c, t, 1400, 0.9, 16, 0.4);
    thump(c, t, 120, 70, 50, 0.4);
  },
};

/** How long a phone taps for each sound that taps. */
const TAPS: Partial<Record<Sound, number>> = { down: 6, detent: 3 };

function play(sound: Sound, weight = 1) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  if (c.state !== "running") void c.resume();
  SOUNDS[sound](c, c.currentTime + 0.001, weight);
  const tap = TAPS[sound];
  if (tap && "vibrate" in navigator) {
    try {
      navigator.vibrate(tap);
    } catch {
      // not allowed here
    }
  }
}

/** Sounds on or off. Turned on, one key's sound says so. */
export function setFeelSounds(on: boolean) {
  const was = enabled;
  enabled = on;
  if (on && !was) play("down");
}

let lastTick = 0;

/**
 * A slider moved by the hand from `from` to `to`: a thud at either end of its range, a clunk into a detent, else a
 * tick for each `step` crossed (at most one every 22 ms, so a fast throw doesn't buzz). Silent within a step.
 */
export function feelSlide(
  from: number,
  to: number,
  {
    min,
    max,
    step = 1,
    detents = [],
  }: { min: number; max: number; step?: number; detents?: readonly number[] },
) {
  const at = Math.round(to / step);
  if (at === Math.round(from / step)) return;
  const now = performance.now();
  if (to <= min || to >= max) play("stop");
  else if (detents.some((d) => Math.round(d / step) === at || (from - d) * (to - d) < 0))
    play("detent");
  else if (now - lastTick >= 22) play("tick");
  else return;
  lastTick = now;
}

const keyOf = (target: EventTarget | null) => {
  const el = target instanceof Element ? target.closest<HTMLElement>(KEYS) : null;
  if (!el || el.closest('[role="slider"]')) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true")
    return null;
  return el;
};

/** A taller key sounds lower: the transport's keys against a pane's small ones, Jali's included. */
const weightOf = (el: HTMLElement) => {
  const h = el.getBoundingClientRect().height;
  return h >= 56 ? 1.45 : h >= 36 ? 1.1 : 0.85;
};

/** Listen to the page for key presses. Call once, at start-up. */
export function installFeel() {
  if (typeof document === "undefined") return;
  let pressed: HTMLElement | null = null;
  const press = (el: HTMLElement) => {
    pressed = el;
    play("down", weightOf(el));
  };
  const release = () => {
    if (!pressed) return;
    play("up", weightOf(pressed));
    pressed = null;
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.button === 0 ? keyOf(e.target) : null;
      if (el) press(el);
    },
    true,
  );
  document.addEventListener("pointerup", release, true);
  document.addEventListener("pointercancel", release, true);
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.repeat || pressed || (e.key !== "Enter" && e.key !== " ")) return;
      const el = keyOf(e.target);
      if (el && el === e.target) press(el);
    },
    true,
  );
  document.addEventListener(
    "keyup",
    (e) => (e.key === "Enter" || e.key === " ") && release(),
    true,
  );
}
