/**
 * The feel of the controls, in sound: a key clacks down and up, a fader and a pan dial tick as they move and thud
 * softly at their centre and their ends, and the speed selector clunks into each detent. The sounds are made here
 * (a burst of noise through a filter, a short low thump), not played from files, on an audio context of their own,
 * so they never reach the mixer's meters or the session's sound.
 *
 * Nothing in the app calls this to make a sound. It listens to the whole page: a press on anything that is a key
 * (a button, a tab, a row that selects), and the value of a slider while a hand is on it. So Jali's own buttons and
 * tabs sound too, and a slider moved by playback (the scrub dial's clock) stays quiet. The jog dial has no detents
 * and is already heard through the session's audio, so it does not tick.
 *
 * ⌘K "Key and dial sounds" turns them off and on; the choice is remembered on this device. A phone that can
 * vibrate gives a short tap with a key and a detent as well.
 */
import { saved } from "../store";

const KEY = "studio:feel-sounds";
const KEYS =
  'button, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="switch"], .key, .lib-row';

let on = saved.read<boolean>(KEY, true);
export const feelSounds = () => on;
export function setFeelSounds(v: boolean) {
  on = v;
  saved.write(KEY, v);
  if (v) play("down", 1);
}

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

/** `weight`: 1 for an ordinary key, more for a big one (lower and fuller), less for a small one. */
function play(sound: Sound, weight = 1) {
  if (!on) return;
  const c = audio();
  if (!c) return;
  if (c.state !== "running") void c.resume();
  const t = c.currentTime + 0.001;
  if (sound === "down") {
    burst(c, t, 2600 / weight, 1.2, 14, 0.5);
    thump(c, t, 190 / weight, 90 / weight, 38, 0.32 * weight);
  } else if (sound === "up") {
    burst(c, t, 3800 / weight, 1.4, 9, 0.24);
    thump(c, t, 260 / weight, 170 / weight, 18, 0.1);
  } else if (sound === "tick") {
    burst(c, t, 5200, 2.5, 4, 0.16);
  } else if (sound === "detent") {
    burst(c, t, 3200, 1.6, 9, 0.4);
    thump(c, t, 320, 180, 24, 0.22);
  } else {
    burst(c, t, 1400, 0.9, 16, 0.4);
    thump(c, t, 120, 70, 50, 0.4);
  }
  if ((sound === "down" || sound === "detent") && "vibrate" in navigator) {
    try {
      navigator.vibrate(sound === "down" ? 6 : 3);
    } catch {
      // not allowed here
    }
  }
}

const keyOf = (target: EventTarget | null) => {
  const el = target instanceof Element ? target.closest<HTMLElement>(KEYS) : null;
  if (!el || el.closest('[role="slider"]')) return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true")
    return null;
  return el;
};
/** A taller key sounds lower: the transport's keys against a pane's small ones. */
const weightOf = (el: HTMLElement) => {
  const h = el.getBoundingClientRect().height;
  return h >= 56 ? 1.45 : h >= 36 ? 1.1 : 0.85;
};

/** Listen to the page. Call once, at start-up. */
export function installFeel() {
  if (typeof document === "undefined") return;
  let pressed: HTMLElement | null = null;
  const release = () => {
    if (!pressed) return;
    play("up", weightOf(pressed));
    pressed = null;
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      const slider =
        e.target instanceof Element ? e.target.closest<HTMLElement>('[role="slider"]') : null;
      if (slider) return hold(slider, true);
      const el = keyOf(e.target);
      if (!el) return;
      pressed = el;
      play("down", weightOf(el));
    },
    true,
  );
  document.addEventListener("pointerup", () => (release(), letGo()), true);
  document.addEventListener("pointercancel", () => (release(), letGo()), true);
  document.addEventListener(
    "keydown",
    (e) => {
      const slider =
        e.target instanceof Element ? e.target.closest<HTMLElement>('[role="slider"]') : null;
      if (slider) return hold(slider, false);
      if (e.repeat || pressed || (e.key !== "Enter" && e.key !== " ")) return;
      const el = keyOf(e.target);
      if (!el || el !== e.target) return;
      pressed = el;
      play("down", weightOf(el));
    },
    true,
  );
  document.addEventListener(
    "keyup",
    (e) => (e.key === "Enter" || e.key === " ") && release(),
    true,
  );
  document.addEventListener(
    "wheel",
    (e) => {
      const slider =
        e.target instanceof Element ? e.target.closest<HTMLElement>('[role="slider"]') : null;
      if (slider) hold(slider, false);
    },
    { capture: true, passive: true },
  );

  // The slider a hand is on, and the value it last sounded at.
  let held: { el: HTMLElement; step: number; timer: ReturnType<typeof setTimeout> | 0 } | null =
    null;
  let lastTick = 0;
  const num = (el: HTMLElement, name: string) => Number(el.getAttribute(name) ?? 0);
  const stepOf = (el: HTMLElement) => {
    const range = num(el, "aria-valuemax") - num(el, "aria-valuemin");
    return Math.round(num(el, "aria-valuenow") / (range > 120 ? 10 : 1));
  };
  /** `byPointer`: until the pointer lifts. Otherwise (keys, the wheel): for a moment after the last move. */
  function hold(el: HTMLElement, byPointer: boolean) {
    if (el.matches(".jog-dial")) return;
    if (held?.timer) clearTimeout(held.timer);
    held = {
      el,
      step: held?.el === el ? held.step : stepOf(el),
      timer: byPointer ? 0 : setTimeout(() => (held = null), 400),
    };
  }
  function letGo() {
    if (held && !held.timer) held = null;
  }
  new MutationObserver(() => {
    if (!held) return;
    const { el } = held;
    const step = stepOf(el);
    if (step === held.step) return;
    const before = held.step;
    held.step = step;
    const now = performance.now();
    const value = num(el, "aria-valuenow");
    const min = num(el, "aria-valuemin");
    const max = num(el, "aria-valuemax");
    const selector = el.matches(".selector-dial");
    const centre = min < 0 && max > 0 && (step === 0 || before * step < 0);
    if (value <= min || value >= max) play("stop");
    else if (selector || centre) play("detent");
    else if (now - lastTick >= 22) play("tick");
    else return;
    lastTick = now;
  }).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-valuenow"],
  });
}
