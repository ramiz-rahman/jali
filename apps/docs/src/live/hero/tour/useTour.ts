/**
 * The hero's tour: plays ./story.ts on the real workspace, once, with a caption per step. It never fights the reader:
 *  - a pointer, a key, a wheel or focus inside the figure (outside the tour's own controls) stops it for good, and the
 *    workspace stays exactly as the tour left it;
 *  - it plays once a session, when the hero is first in view, and never by itself on a phone or with reduced motion;
 *  - while it plays, nothing it does moves keyboard focus (the store's `focusHeld` holds Jali's own focus moves back);
 *  - it pauses while the hero is out of view or the tab is hidden, and everything is torn down on unmount.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import type { JaliStore } from "jali-layout/adapter";
import { readStored, STORAGE_KEYS, writeStored } from "../../../ui/lib/storage";
import { createClock, Stopped, type Clock } from "./clock";
import { createDriver, settle, type TourPanel } from "./driver";
import { STORY, type Step } from "./story";

export type TourStatus = "idle" | "playing" | "paused" | "stopped" | "done";

export interface TourOptions {
  store: JaliStore;
  fig: RefObject<HTMLElement | null>;
  /** The workspace's box. */
  wrap: RefObject<HTMLElement | null>;
  /** The soft cursor, inside the stage. */
  cursor: RefObject<HTMLElement | null>;
  /** Show the tree panel in a view for a while; `null` puts back what the reader chose. */
  showPanel(view: TourPanel | null): void;
  /** Light a node of the tree, as hovering it does (`null`: none). */
  hover(node: string | null): void;
  /** Back to the start: the layout the figure began with. */
  reset(): void;
}

export interface Tour {
  status: TourStatus;
  /** The step on screen, while playing or paused. */
  step: number;
  steps: number;
  /** The step on screen's caption and what it shows beside it, while playing or paused. */
  current: Pick<Step, "caption" | "aside"> | null;
  /** Reduced motion is on (the steps cut). */
  cut: boolean;
  /** Play, pause, or carry on after a stop. */
  toggle(): void;
  replay(): void;
}

/**
 * While the tour plays, its caption says what is happening, once per step. Jali's own announcer would also read out
 * every move the tour makes ("Showing Order 1047", …), so it is quiet until the tour ends.
 */
function quietAnnouncer(scope: HTMLElement | null) {
  const el = scope?.querySelector<HTMLElement>('[data-testid="announcer"]');
  if (!el) return () => {};
  const live = el.getAttribute("aria-live");
  el.setAttribute("aria-live", "off");
  el.setAttribute("aria-hidden", "true");
  return () => {
    if (live === null) el.removeAttribute("aria-live");
    else el.setAttribute("aria-live", live);
    el.removeAttribute("aria-hidden");
  };
}

/** Played (or stopped) once this session: it doesn't play by itself again. With storage blocked, it may. */
const seen = () => readStored(STORAGE_KEYS.heroTour, "session") === "1";
const markSeen = () => writeStored(STORAGE_KEYS.heroTour, "1", "session");
const media = (q: string) => (typeof matchMedia === "function" ? matchMedia(q).matches : false);

export function useTour(o: TourOptions): Tour {
  const [status, setStatus] = useState<TourStatus>("idle");
  const [step, setStep] = useState(0);
  const [cut, setCut] = useState(false);
  const live = useRef({
    status: "idle" as TourStatus,
    step: 0,
    clock: null as Clock | null,
    focus: null as JaliStore | null,
    unquiet: null as (() => void) | null,
    away: false,
    held: false,
  });
  const opts = useRef(o);
  opts.current = o;

  const set = (s: TourStatus) => {
    live.current.status = s;
    setStatus(s);
  };
  /**
   * Everything a run holds, let go: its clock (so a step waiting on it stops), the cursor and any drag it is showing,
   * Jali's focus, and the announcer. Ending, replaying and unmounting all start here.
   */
  const release = () => {
    const l = live.current;
    l.clock?.stop();
    l.clock = null;
    settle(opts.current.store, opts.current.cursor.current);
    if (l.focus) l.focus.focusHeld = false;
    l.focus = null;
    l.unquiet?.();
    l.unquiet = null;
  };
  const end = (s: "stopped" | "done") => {
    release();
    // The tree panel goes back to what the reader chose (the tour closes it until its last step).
    opts.current.showPanel(null);
    opts.current.hover(null);
    markSeen();
    set(s);
  };

  const play = (from: number) => {
    const l = live.current;
    const ws = opts.current.wrap.current;
    if (!ws) return;
    l.clock?.stop();
    const clock = createClock();
    l.clock = clock;
    // Jali moves no focus of its own while the tour drives it, so the reader's keyboard focus stays where it was.
    if (l.focus) l.focus.focusHeld = false;
    l.focus = opts.current.store;
    l.focus.focusHeld = true;
    l.unquiet ??= quietAnnouncer(ws);
    const reduced = media("(prefers-reduced-motion: reduce)");
    setCut(reduced);
    if (l.away) clock.pause();
    l.held = false;
    set("playing");
    const driver = createDriver({
      store: opts.current.store,
      ws,
      cursor: opts.current.cursor,
      clock,
      reduced,
      showPanel: (v) => opts.current.showPanel(v),
      hover: (n) => opts.current.hover(n),
    });
    void (async () => {
      try {
        for (let i = from; i < STORY.length; i++) {
          const s = STORY[i]!;
          if (s.skip?.(driver)) continue;
          l.step = i;
          setStep(i);
          await s.run(driver);
        }
        if (l.clock === clock) end("done");
      } catch (e) {
        if (!(e instanceof Stopped)) {
          console.error(e);
          if (l.clock === clock) end("stopped");
        }
      }
    })();
  };

  const replay = () => {
    release();
    opts.current.reset();
    play(0);
  };
  const toggle = () => {
    const l = live.current;
    if (l.status === "playing") {
      l.held = true;
      l.clock?.pause();
      set("paused");
    } else if (l.status === "paused") {
      l.held = false;
      if (!l.away) l.clock?.resume();
      set("playing");
    } else if (l.status === "stopped") play(l.step);
    else replay();
  };

  useEffect(() => {
    const fig = o.fig.current;
    if (!fig) return;
    const l = live.current;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    // The reader: anything they do inside the figure, outside the tour's own controls.
    const touch = (e: Event) => {
      if (!e.isTrusted) return;
      if ((e.target as Element | null)?.closest?.("[data-tour-controls]")) return;
      if (l.status === "playing" || l.status === "paused") end("stopped");
      else if (l.status === "idle") {
        // They got there first: the tour never starts by itself now.
        markSeen();
        clearTimeout(startTimer);
      }
    };
    const kinds = ["pointerdown", "keydown", "wheel", "focusin"] as const;
    for (const k of kinds) fig.addEventListener(k, touch, { capture: true, passive: true });

    const autoplay =
      !seen() && !media("(prefers-reduced-motion: reduce)") && !media("(max-width: 767px)");
    let started = false;
    const away = (yes: boolean) => {
      l.away = yes;
      if (l.status !== "playing") return;
      if (yes) l.clock?.pause();
      else if (!l.held) l.clock?.resume();
    };
    let inView = false;
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            ([entry]) => {
              inView = !!entry && entry.intersectionRatio >= 0.35;
              away(!inView || document.hidden);
              if (inView && autoplay && !started && !seen()) {
                started = true;
                startTimer = setTimeout(() => {
                  if (l.status === "idle" && !seen()) play(0);
                }, 900);
              }
            },
            { threshold: [0, 0.35, 0.6] },
          )
        : null;
    io?.observe(fig);
    const onVisibility = () => away(!inView || document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      for (const k of kinds) fig.removeEventListener(k, touch, { capture: true });
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(startTimer);
      release();
    };
    // The figure and the workspace are mounted once; the rest is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = status === "playing" || status === "paused";
  return {
    status,
    step,
    steps: STORY.length,
    current: running ? STORY[step]! : null,
    cut,
    toggle,
    replay,
  };
}
