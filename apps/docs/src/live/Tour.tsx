/**
 * The hero's tour: a short script that drives the real workspace through `jali.actions`, once, with a caption per
 * step. It never fights the reader:
 *  - a pointer, a key, a wheel or focus inside the figure (outside the tour's own controls) stops it for good, and the
 *    workspace stays exactly as the tour left it;
 *  - it plays once a session, when the hero is first in view, and never by itself on a phone or with reduced motion;
 *  - while it plays, nothing it does moves keyboard focus (the store's `focusHeld` holds Jali's own focus moves back);
 *  - it pauses while the hero is out of view or the tab is hidden, and everything is torn down on unmount.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowCounterClockwiseIcon,
  LinkSimpleIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { buildSearch, GAP, tabDropAt, zoneFor, type JaliStore } from "jali/adapter";
import type { DndState, JaliActions, JaliModel } from "jali/adapter";
import { orderKind } from "./kinds";

export type TourStatus = "idle" | "playing" | "paused" | "stopped" | "done";

/** A point on the page, in client pixels. */
interface At {
  x: number;
  y: number;
}

/** What a step can do: wait (paused and stopped with the tour), drive the workspace, and point at things. */
interface Ctx {
  wait(ms: number): Promise<void>;
  /** Reduced motion: the steps cut, with no cursor and no animated width or drag. */
  cut: boolean;
  actions: JaliActions;
  model(): JaliModel;
  ws: HTMLElement;
  /** A pane's element, or something inside it (`sel`). */
  pane(id: string | undefined, sel?: string): Element | null;
  /** A tab's element in a strip. */
  tab(id: string): Element | null;
  /** Move the soft cursor to an element's centre (null hides it); `press` shows a click. */
  point(el: Element | null | undefined, press?: boolean): void;
  /**
   * Drag `pane` from an element (its title or its tab) to a point, as a person would: the cursor presses, the chip and
   * the drop preview follow it, and the drop is the one a person's release makes. Resolves whether it dropped.
   */
  drag(pane: string, from: Element | null, to: At | null): Promise<boolean>;
  /** The workspace's width inside the figure: px, or null for all of it. Resolves when the change has played. */
  room(px: number | null): Promise<void>;
  /** Show the JSON beside the workspace (without changing what the reader chose to keep). */
  showJson(): void;
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

/** A point inside an element's box, as fractions of its width and height. */
function inside(el: Element | null, fx: number, fy: number): At | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}

/** The pane the order list's detail and customer are: found by kind, since a drop can't rename them. */
const byKind = (t: Ctx, kind: string) => t.model().panes.find((p) => p.ref.kind === kind)?.id;
/** A drag needs panes side by side: one at a time (a phone) has nothing to drop on. */
const oneAtATime = (t: Ctx) => t.model().onePane;

const ORDERS = [1047, 1046];

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
      await t.wait(400);
    },
  },
  {
    id: "merge",
    caption: "Drop one pane on another, and they share a place as tabs.",
    skip: oneAtATime,
    async run(t) {
      const customer = byKind(t, "customer"),
        order = byKind(t, "order");
      if (!customer || !order) return;
      await t.drag(customer, t.pane(customer, ".jali-pane-title"), inside(t.pane(order), 0.5, 0.5));
      await t.wait(1700);
    },
  },
  {
    id: "reorder",
    caption: "Drag a tab along its strip to put it in a new place.",
    skip: (t) => oneAtATime(t) || !t.model().stackOf(byKind(t, "customer")),
    async run(t) {
      const customer = byKind(t, "customer")!,
        order = byKind(t, "order")!;
      await t.drag(customer, t.tab(customer), inside(t.tab(order), 0.2, 0.5));
      await t.wait(1500);
    },
  },
  {
    id: "pin",
    caption: "Pin a tab, and it stays at the front.",
    skip: (t) => oneAtATime(t) || !t.model().stackOf(byKind(t, "order")),
    async run(t) {
      const order = byKind(t, "order")!;
      t.point(t.tab(order));
      await t.wait(t.cut ? 0 : 700);
      t.point(t.tab(order), true);
      await t.wait(t.cut ? 0 : 300);
      t.actions.setPinned(order, true);
      await t.wait(t.cut ? 0 : 450);
      // The tab moved to the front: the cursor goes with it.
      t.point(t.tab(order));
      await t.wait(1500);
      t.point(null);
    },
  },
  {
    id: "split",
    caption: "Drag a tab to the edge of a pane, and it splits out beside it.",
    skip: (t) => oneAtATime(t) || !t.model().stackOf(byKind(t, "customer")),
    async run(t) {
      const customer = byKind(t, "customer")!;
      await t.drag(customer, t.tab(customer), inside(t.pane("orders"), 0.5, 0.88));
      await t.wait(1900);
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
      await t.wait(1900);
    },
  },
  {
    id: "unfold",
    caption: "More room: it comes back where it was.",
    skip: (t) => !t.ws.style.width,
    async run(t) {
      await t.room(null);
      await t.wait(1400);
    },
  },
  {
    id: "link",
    caption: "Every change is in the layout, and in its link.",
    async run(t) {
      // The JSON from its start: the split the tour just made is its first child.
      t.showJson();
      await t.wait(4300);
    },
  },
  {
    id: "end",
    caption: "Your turn. Drag a tab, or click anything.",
    async run(t) {
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

/** The drag's ease: slow off the mark, slow into the drop, as a hand moves. */
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/**
 * What a person's drag shows with the pointer at (x, y): the same rule as Jali's own drag (workspace/dnd.ts). Over its
 * own strip a tab reorders; over a pane, its edges place beside and its middle adds a tab; its own group's middle
 * does nothing.
 */
function dragAt(store: JaliStore, pane: string, ws: HTMLElement, x: number, y: number): DndState {
  const box = ws.querySelector(".jali-layout")?.getBoundingClientRect();
  const p = { x: x - (box?.left ?? 0) - GAP, y: y - (box?.top ?? 0) - GAP };
  const tabAt = tabDropAt(store, pane, x, y);
  if (tabAt) return { dragged: pane, ...p, tabAt };
  const boxes = store.model().resolved.panes;
  const hit = boxes.find(
    (b) =>
      !b.hidden &&
      b.id !== pane &&
      p.x >= b.rect.x &&
      p.x <= b.rect.x + b.rect.width &&
      p.y >= b.rect.y &&
      p.y <= b.rect.y + b.rect.height,
  );
  let zone = hit ? zoneFor(hit.rect, p.x, p.y) : undefined;
  const own = boxes.find((b) => b.id === pane)?.stackId;
  if (hit?.stackId && hit.stackId === own && zone === "centre") zone = undefined;
  return { dragged: pane, ...p, ...(hit && zone ? { target: hit.id, zone } : {}) };
}

export interface TourOptions {
  /** Off: no tour, no listeners. */
  enabled: boolean;
  store: JaliStore;
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
    focus: null as JaliStore | null,
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
  /** A drag the tour is showing, put away: its chip and preview never outlive the tour. */
  const dropDrag = () => {
    const c = opts.current.cursor.current;
    if (c) delete c.dataset.drag;
    const { store } = opts.current;
    if (store.get().dnd) store.set({ dnd: null });
  };
  const end = (s: "stopped" | "done") => {
    const l = live.current;
    l.clock?.stop();
    dropDrag();
    l.clock = null;
    if (l.focus) l.focus.focusHeld = false;
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
    const cursorTo = (x: number, y: number) => {
      const c = opts.current.cursor.current;
      const stage = c?.parentElement;
      if (!c || !stage || reduced) return;
      const b = stage.getBoundingClientRect();
      c.style.translate = `${x - b.left}px ${y - b.top}px`;
      c.dataset.on = "";
    };
    const centre = (el: Element) => {
      const a = el.getBoundingClientRect();
      return { x: a.left + Math.min(a.width / 2, 56), y: a.top + a.height / 2 };
    };
    const ctx: Ctx = {
      wait: (ms) => clock.wait(ms),
      cut: reduced,
      actions: store.jali.actions,
      model: () => store.jali.model(),
      ws,
      pane: (id, sel) => {
        const el = id ? ws.querySelector(`[data-pane="${CSS.escape(id)}"]`) : null;
        return sel ? (el?.querySelector(sel) ?? null) : el;
      },
      tab: (id) => ws.querySelector(`.jali-tab-item [data-tab="${CSS.escape(id)}"]`),
      point(el, press) {
        const c = opts.current.cursor.current;
        if (!c) return;
        if (!el || reduced) return cursorOff();
        const p = centre(el);
        cursorTo(p.x, p.y);
        if (press) {
          delete c.dataset.press;
          void c.offsetWidth;
          c.dataset.press = "";
        }
      },
      async drag(pane, from, to) {
        if (!from || !to) return false;
        const start = centre(from);
        const show = (x: number, y: number) => store.set({ dnd: dragAt(store, pane, ws, x, y) });
        if (reduced) {
          // No motion: the drop preview where the drag would end, held long enough to read, then the drop.
          show(to.x, to.y);
          await clock.wait(1100);
        } else {
          ctx.point(from);
          await clock.wait(700);
          ctx.point(from, true);
          await clock.wait(260);
          // Held: the cursor follows each frame, without its own easing.
          const c = opts.current.cursor.current;
          if (c) c.dataset.drag = "";
          const frames = 54;
          for (let i = 1; i <= frames; i++) {
            const k = ease(i / frames);
            const x = start.x + (to.x - start.x) * k,
              y = start.y + (to.y - start.y) * k;
            cursorTo(x, y);
            show(x, y);
            await clock.wait(16);
          }
          // Over the drop: the preview says what letting go will do.
          await clock.wait(750);
        }
        const d = store.get().dnd;
        dropDrag();
        cursorOff();
        // The release a person's drag makes (workspace/dnd.ts).
        if (d?.tabAt) store.actions.moveTab(pane, d.tabAt.index);
        else if (d?.target && d.zone) store.actions.drop(pane, d.target, d.zone);
        else return false;
        return true;
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
    };
    return ctx;
  };

  const play = (from: number) => {
    const l = live.current;
    if (!opts.current.wrap.current) return;
    l.clock?.stop();
    const clock = createClock();
    l.clock = clock;
    // Jali moves no focus of its own while the tour drives it, so the reader's keyboard focus stays where it was.
    if (l.focus) l.focus.focusHeld = false;
    l.focus = opts.current.store;
    l.focus.focusHeld = true;
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
    dropDrag();
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
      dropDrag();
      if (l.focus) l.focus.focusHeld = false;
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
function Address({ store }: { store: JaliStore }) {
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
  store: JaliStore;
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
            title={playing ? "Pause the tour" : "Play the tour"}
            onClick={tour.toggle}
          >
            {playing ? (
              <PauseIcon size={14} weight="fill" aria-hidden />
            ) : (
              <PlayIcon size={14} weight="fill" aria-hidden />
            )}
            <span>{playing ? "Pause tour" : "Play tour"}</span>
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
