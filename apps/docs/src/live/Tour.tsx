/**
 * The hero's tour: a short script that drives the real workspace through `jali.actions`, once, with a caption per
 * step. It never fights the reader:
 *  - a pointer, a key, a wheel or focus inside the figure (outside the tour's own controls) stops it for good, and the
 *    workspace stays exactly as the tour left it;
 *  - it plays once a session, when the hero is first in view, and never by itself on a phone or with reduced motion;
 *  - while it plays, nothing it does moves keyboard focus (Jali's own focus moves inside the workspace are held back);
 *  - it pauses while the hero is out of view or the tab is hidden, and everything is torn down on unmount.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowCounterClockwiseIcon,
  LinkSimpleIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { buildSearch, type UiStore } from "@jali/core/adapter";
import type { JaliActions, JaliModel } from "@jali/core/adapter";
import { notesKind, orderKind } from "./kinds";

export type TourStatus = "idle" | "playing" | "paused" | "stopped" | "done";

/** What a step can do: wait (paused and stopped with the tour), drive the workspace, and point at things. */
interface Ctx {
  wait(ms: number): Promise<void>;
  /** Reduced motion: the steps cut, with no cursor and no animated width. */
  cut: boolean;
  actions: JaliActions;
  model(): JaliModel;
  ws: HTMLElement;
  /** Move the soft cursor to an element's centre (null hides it); `press` shows a click. */
  point(el: Element | null | undefined, press?: boolean): void;
  /** The workspace's width inside the figure: px, or null for all of it. Resolves when the change has played. */
  room(px: number | null): Promise<void>;
  /** Show the JSON beside the workspace (without changing what the reader chose to keep). */
  showJson(): void;
  /** Scroll the JSON panel (never the page) to a node's first line. */
  jsonTo(node: string): void;
  /** Type into the palette's field, a letter at a time. */
  type(text: string): Promise<void>;
  /** Press Enter in the palette's field. */
  enter(): void;
}

interface Step {
  id: string;
  caption: string;
  /** Leave the step out (said nothing, shown done): when it can't show what it says, as on a phone. */
  skip?(t: Ctx): boolean;
  run(t: Ctx): Promise<void>;
}

/** A pane that is folded or behind a tab is shown first (a phone shows one pane at a time). */
async function reveal(t: Ctx, pane: string | undefined) {
  const m = t.model();
  if (!pane || m.visible.includes(pane)) return;
  t.actions.focus(pane);
  await t.wait(900);
}

const ORDERS = [1047, 1046, 1045];

const STEPS: Step[] = [
  {
    id: "follow",
    caption: "Pick an order. Its detail and its customer follow.",
    async run(t) {
      await t.wait(500);
      for (const id of ORDERS) {
        t.point(t.ws.querySelector(`[data-pane="orders"] [id$="-o-${id}"]`));
        await t.wait(t.cut ? 0 : 650);
        t.point(t.ws.querySelector(`[data-pane="orders"] [id$="-o-${id}"]`), true);
        t.actions.select("orders", orderKind({ id }));
        await t.wait(1050);
      }
      t.point(null);
      // One pane at a time: show the detail, which followed.
      await reveal(t, "order");
      await t.wait(500);
    },
  },
  {
    id: "fold",
    caption: "Less room: a pane folds into a tab.",
    // Already folding (a phone): there is no room to take away.
    skip: (t) => t.model().folded.length > 0,
    async run(t) {
      const full = t.ws.parentElement?.clientWidth ?? 900;
      await t.room(Math.round(Math.min(480, full * 0.6)));
      await t.wait(2200);
    },
  },
  {
    id: "unfold",
    caption: "More room: it comes back where it was.",
    skip: (t) => !t.ws.style.width,
    async run(t) {
      await t.room(null);
      await t.wait(1800);
    },
  },
  {
    id: "link",
    caption: "Open the customer's notes. The layout changes, and its link with it.",
    async run(t) {
      t.showJson();
      await t.wait(700);
      const m = t.model();
      const customer =
        m.panes.find((p) => p.ref.kind === "customer" && m.visible.includes(p.id)) ??
        m.panes.find((p) => p.ref.kind === "customer");
      const id = Number(customer?.ref.params.id ?? 7);
      await reveal(t, customer?.id);
      const button = customer
        ? t.ws.querySelector(`[data-pane="${customer.id}"] .live-k-link`)
        : null;
      t.point(button);
      await t.wait(t.cut ? 0 : 800);
      t.point(button, true);
      await t.wait(t.cut ? 0 : 380);
      t.point(null);
      const opened = t.actions.openBeside(customer?.id ?? "customer", notesKind({ customer: id }));
      // The new pane's lines are at the end of the JSON: bring them into view while their band shows.
      await t.wait(80);
      if (opened.pane) t.jsonTo(opened.pane);
      await t.wait(3900);
    },
  },
  {
    id: "palette",
    caption: "Press ⌘K and type a command: maximise a pane, then restore it.",
    async run(t) {
      if (t.model().panes.some((p) => p.id === "order")) t.actions.focus("order");
      await t.wait(400);
      for (const [word, dwell] of [
        ["max", 2000],
        ["restore", 1300],
      ] as const) {
        t.actions.openPalette();
        await t.wait(550);
        await t.type(word);
        await t.wait(650);
        t.enter();
        await t.wait(dwell);
      }
    },
  },
  {
    id: "end",
    caption: "Close the notes, and it's your turn. Click anything.",
    async run(t) {
      const notes = t.model().panes.find((p) => p.ref.kind === "notes");
      if (notes) {
        await t.wait(300);
        const x = t.ws.querySelector(
          `[data-pane="${notes.id}"] .jali-pane-header button[aria-label^="Close"]`,
        );
        t.point(x);
        await t.wait(t.cut ? 0 : 750);
        t.point(x, true);
        await t.wait(t.cut ? 0 : 380);
        t.point(null);
        t.actions.close(notes.id);
      }
      await t.wait(2800);
    },
  },
];

/** The steps' captions, in order (for tests and the report). */
export const tourCaptions = STEPS.map((s) => s.caption);

class Stopped extends Error {}

/** Timers a tour waits on: paused and resumed with it, and rejected when it stops. */
function createClock() {
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
type Clock = ReturnType<typeof createClock>;

/**
 * While the tour plays, Jali's own focus moves into the workspace (a pane after a change, the palette's field on open,
 * the palette handing focus back) would take the reader's keyboard focus, so they are held back. `hush` also holds
 * back focus moves elsewhere for a moment, for the palette handing focus back to where it was when it opened.
 */
function holdFocus(scope: () => HTMLElement | null) {
  const proto = HTMLElement.prototype;
  const original = proto.focus;
  let hushUntil = 0;
  function held(this: HTMLElement, options?: FocusOptions) {
    const s = scope();
    if (s && s.contains(this)) return;
    if (performance.now() < hushUntil && this !== document.activeElement) return;
    return original.call(this, options);
  }
  proto.focus = held;
  return {
    hush(ms: number) {
      hushUntil = performance.now() + ms;
    },
    release() {
      if (proto.focus === held) proto.focus = original;
    },
  };
}

/**
 * While the tour plays, its caption says what is happening, once per step. Jali's own announcer would also read out
 * every move the tour makes ("Showing Order 1047", "Showing Tomás Ruiz", …), so it is quiet until the tour ends.
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

const SEEN_KEY = "jali-docs:hero-tour";
const seen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage blocked: it may play again on the next visit */
  }
};
const media = (q: string) => (typeof matchMedia === "function" ? matchMedia(q).matches : false);

const INPUT_VALUE = () => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

export interface TourOptions {
  /** Off: no tour, no listeners. */
  enabled: boolean;
  store: UiStore;
  fig: RefObject<HTMLElement | null>;
  /** The workspace's box (its width is what folds). */
  wrap: RefObject<HTMLElement | null>;
  /** The soft cursor, inside the stage. */
  cursor: RefObject<HTMLElement | null>;
  /** Show the JSON panel for a while; `null` puts back what the reader chose. */
  showPanel(view: "json" | null): void;
  /** Back to the start: the layout the figure began with. */
  reset(): void;
}

export interface Tour {
  status: TourStatus;
  /** The step on screen, while playing or paused. */
  step: number;
  steps: number;
  caption: string | null;
  /** The step's id (the link step shows the address). */
  stepId: string | null;
  /** Reduced motion is on (the steps cut). */
  cut: boolean;
  /** Play, pause, or carry on after a stop. */
  toggle(): void;
  replay(): void;
  /** The workspace's width back to all of the figure (the reset button). */
  fullRoom(): void;
}

export function useTour(o: TourOptions): Tour {
  const [status, setStatus] = useState<TourStatus>("idle");
  const [step, setStep] = useState(0);
  const [cut, setCut] = useState(false);
  const live = useRef({
    status: "idle" as TourStatus,
    step: 0,
    clock: null as Clock | null,
    focus: null as ReturnType<typeof holdFocus> | null,
    unquiet: null as (() => void) | null,
    away: false,
    held: false,
    roomTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const opts = useRef(o);
  opts.current = o;

  const set = (s: TourStatus) => {
    live.current.status = s;
    setStatus(s);
  };
  const cursorOff = () => {
    const c = opts.current.cursor.current;
    if (c) delete c.dataset.on;
  };
  const freezeRoom = () => {
    const ws = opts.current.wrap.current;
    clearTimeout(live.current.roomTimer);
    if (!ws || !ws.style.width) return;
    // Where the width is right now, mid-change or not: the workspace stays exactly as the tour left it.
    ws.style.width = `${ws.getBoundingClientRect().width}px`;
    delete ws.dataset.tourAnim;
  };
  const fullRoom = () => {
    const ws = opts.current.wrap.current;
    clearTimeout(live.current.roomTimer);
    if (!ws) return;
    ws.style.width = "";
    delete ws.dataset.tourAnim;
    delete opts.current.fig.current?.dataset.tourRoom;
  };
  const end = (s: "stopped" | "done") => {
    const l = live.current;
    l.clock?.stop();
    l.clock = null;
    l.focus?.release();
    l.focus = null;
    l.unquiet?.();
    l.unquiet = null;
    cursorOff();
    if (s === "stopped") freezeRoom();
    markSeen();
    set(s);
  };

  const ctxFor = (clock: Clock, reduced: boolean): Ctx => {
    const { store } = opts.current;
    const ws = opts.current.wrap.current!;
    const input = () => ws.querySelector<HTMLInputElement>(".jali-palette-input");
    const fill = (text: string) => {
      const el = input();
      if (!el) return;
      INPUT_VALUE()?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    return {
      wait: (ms) => clock.wait(ms),
      cut: reduced,
      actions: store.jali.actions,
      model: () => store.jali.model(),
      ws,
      point(el, press) {
        const c = opts.current.cursor.current;
        const stage = c?.parentElement;
        if (!c || !stage) return;
        if (!el || reduced) return cursorOff();
        const a = el.getBoundingClientRect(),
          b = stage.getBoundingClientRect();
        const x = a.left - b.left + Math.min(a.width / 2, 56),
          y = a.top - b.top + a.height / 2;
        c.style.translate = `${x}px ${y}px`;
        c.dataset.on = "";
        if (press) {
          delete c.dataset.press;
          void c.offsetWidth;
          c.dataset.press = "";
        }
      },
      room(px) {
        const fig = opts.current.fig.current;
        const from = ws.getBoundingClientRect().width;
        const to = px ?? ws.parentElement?.clientWidth ?? from;
        clearTimeout(live.current.roomTimer);
        if (reduced) {
          delete ws.dataset.tourAnim;
          ws.style.width = px === null ? "" : `${px}px`;
        } else {
          delete ws.dataset.tourAnim;
          ws.style.width = `${from}px`;
          void ws.offsetWidth;
          ws.dataset.tourAnim = "";
          ws.style.width = `${to}px`;
        }
        if (fig) {
          if (px === null) delete fig.dataset.tourRoom;
          else fig.dataset.tourRoom = "";
        }
        const settle = () => {
          delete ws.dataset.tourAnim;
          if (px === null) ws.style.width = "";
        };
        if (reduced) return clock.wait(0);
        live.current.roomTimer = setTimeout(settle, 1300);
        return clock.wait(1300);
      },
      showJson: () => opts.current.showPanel("json"),
      jsonTo(node) {
        const pre = opts.current.fig.current?.querySelector<HTMLElement>(".live-json");
        const line = pre?.querySelector<HTMLElement>(`[data-node="${CSS.escape(node)}"]`);
        if (!pre || !line) return;
        pre.scrollTo({
          top: Math.max(0, line.offsetTop - pre.clientHeight / 4),
          behavior: reduced ? "auto" : "smooth",
        });
      },
      async type(text) {
        if (reduced) return fill(text);
        for (let i = 1; i <= text.length; i++) {
          fill(text.slice(0, i));
          await clock.wait(120);
        }
      },
      enter() {
        const el = input();
        if (!el) return;
        live.current.focus?.hush(400);
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      },
    };
  };

  const play = (from: number) => {
    const l = live.current;
    if (!opts.current.wrap.current) return;
    l.clock?.stop();
    const clock = createClock();
    l.clock = clock;
    l.focus?.release();
    l.focus = holdFocus(() => opts.current.wrap.current);
    l.unquiet ??= quietAnnouncer(opts.current.wrap.current);
    const reduced = media("(prefers-reduced-motion: reduce)");
    setCut(reduced);
    if (l.away) clock.pause();
    l.held = false;
    set("playing");
    const ctx = ctxFor(clock, reduced);
    void (async () => {
      try {
        for (let i = from; i < STEPS.length; i++) {
          const step = STEPS[i]!;
          if (step.skip?.(ctx)) continue;
          l.step = i;
          setStep(i);
          await step.run(ctx);
        }
        if (l.clock !== clock) return;
        opts.current.showPanel(null);
        end("done");
      } catch (e) {
        if (!(e instanceof Stopped)) {
          console.error(e);
          if (l.clock === clock) end("stopped");
        }
      }
    })();
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
  const replay = () => {
    const l = live.current;
    l.clock?.stop();
    l.clock = null;
    cursorOff();
    fullRoom();
    opts.current.reset();
    play(0);
  };

  useEffect(() => {
    if (!o.enabled) return;
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
      clearTimeout(l.roomTimer);
      l.clock?.stop();
      l.clock = null;
      l.focus?.release();
      l.focus = null;
      l.unquiet?.();
      l.unquiet = null;
    };
    // The figure and the workspace are mounted once; the rest is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.enabled]);

  const running = status === "playing" || status === "paused";
  return {
    status,
    step,
    steps: STEPS.length,
    caption: running ? STEPS[step]!.caption : null,
    stepId: running ? STEPS[step]!.id : null,
    cut,
    toggle,
    replay,
    fullRoom,
  };
}

/** What the address would say for this layout: the same search string Jali writes into a real one. */
function Address({ store }: { store: UiStore }) {
  const search = buildSearch("", store.get());
  return (
    <span className="live-tour-address" title="The address this layout writes" key={search}>
      <LinkSimpleIcon size={14} aria-hidden />
      <code>
        <span>shop.example/orders</span>
        {decodeURIComponent(search)}
      </code>
    </span>
  );
}

/**
 * The row above the figure: the step's caption while the tour plays (the things to try otherwise), the tour's
 * controls, and a polite live region that says each caption once.
 */
export function TourBar({
  tour,
  store,
  tries,
}: {
  tour: Tour;
  store: UiStore;
  /** The things to try, shown when the tour is not playing. */
  tries: ReactNode;
}) {
  const playing = tour.status === "playing";
  const running = playing || tour.status === "paused";
  return (
    <div className="live-tour-bar" data-status={tour.status}>
      {running ? (
        <span className="live-tour-steps" aria-hidden>
          {Array.from({ length: tour.steps }, (_, i) => (
            <i
              key={i}
              data-at={i === tour.step || undefined}
              data-done={i < tour.step || undefined}
            />
          ))}
        </span>
      ) : null}
      {running ? (
        <div className="live-tour-caption" aria-hidden>
          <span className="live-tour-text" key={tour.step}>
            {tour.caption}
          </span>
          {tour.stepId === "link" ? <Address store={store} /> : null}
        </div>
      ) : (
        tries
      )}
      <span className="live-tour-controls" data-tour-controls="" role="group" aria-label="Tour">
        {tour.status === "done" ? null : (
          <button
            type="button"
            className="live-tour-btn"
            aria-pressed={playing}
            title={playing ? "Pause the tour" : "Play the tour"}
            onClick={tour.toggle}
          >
            {playing ? (
              <PauseIcon size={14} weight="fill" aria-hidden />
            ) : (
              <PlayIcon size={14} weight="fill" aria-hidden />
            )}
            <span>Play tour</span>
          </button>
        )}
        {tour.status !== "idle" ? (
          <button
            type="button"
            className="live-tour-btn"
            title="Play the tour again from the start"
            onClick={tour.replay}
          >
            <ArrowCounterClockwiseIcon size={14} aria-hidden />
            <span>Replay</span>
          </button>
        ) : null}
      </span>
      <p className="live-sr" aria-live="polite">
        {running ? tour.caption : ""}
      </p>
    </div>
  );
}
