/**
 * What a tour step can do to the hero: wait, drive the workspace through Jali's actions, point the soft cursor at
 * things, and drag a pane as a person would. Everything a step does goes through here, so stopping the tour (its
 * clock) stops it all, and the cursor and a drag in progress are put away in one place (`settle`).
 */
import type { RefObject } from "react";
import type { JaliActions, JaliStore, Model } from "jali/adapter";
import { dragAt } from "../../workspace/jali-gaps";
import type { Clock } from "./clock";

/** A point on the page, in client pixels. */
export interface At {
  x: number;
  y: number;
}

export interface Driver {
  wait(ms: number): Promise<void>;
  /** Reduced motion: the steps cut, with no cursor and no animated drag. */
  cut: boolean;
  actions: JaliActions;
  model(): Model;
  ws: HTMLElement;
  /** A pane's element, or something inside it (`sel`). */
  pane(id: string | undefined, sel?: string): Element | null;
  /** Move the soft cursor to an element's centre (null hides it); `press` shows a click. */
  point(el: Element | null | undefined, press?: boolean): void;
  /**
   * Drag `pane` from an element (its title or its tab) to a point, as a person would: the cursor presses, the chip and
   * the drop preview follow it, and the drop is the one a person's release makes. Resolves whether it dropped.
   */
  drag(pane: string, from: Element | null, to: At | null): Promise<boolean>;
  /** Show the layout tree beside the workspace, or close it (without changing what the reader chose to keep). */
  panel(view: TourPanel): void;
  /**
   * Light a layout node's lines in the tree's JSON, and its panes with them, as hovering them does; scrolls the JSON to
   * them and returns their first line, for the cursor. `null` puts the light out.
   */
  light(node: string | null): Element | null;
}

/** What the tour can show beside the workspace. */
export type TourPanel = "map" | "json" | "closed";

/** A point inside an element's box, as fractions of its width and height. */
export function inside(el: Element | null, fx: number, fy: number): At | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}

/** The drag's ease: slow off the mark, slow into the drop, as a hand moves. */
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export interface DriverParts {
  store: JaliStore;
  ws: HTMLElement;
  cursor: RefObject<HTMLElement | null>;
  clock: Clock;
  reduced: boolean;
  showPanel(view: TourPanel): void;
  /** Light a node of the tree, as hovering it does (`null`: none). */
  hover(node: string | null): void;
}

/** The cursor hidden and a drag's chip and preview gone: what the tour leaves when it ends or stops. */
export function settle(store: JaliStore, cursor: HTMLElement | null) {
  if (cursor) {
    delete cursor.dataset.on;
    delete cursor.dataset.drag;
  }
  if (store.get().dnd) store.set({ dnd: null });
}

export function createDriver({
  store,
  ws,
  cursor,
  clock,
  reduced,
  showPanel,
  hover,
}: DriverParts): Driver {
  const cursorTo = (x: number, y: number) => {
    const c = cursor.current;
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
  const driver: Driver = {
    wait: (ms) => clock.wait(ms),
    cut: reduced,
    actions: store.jali.actions,
    model: () => store.model(),
    ws,
    pane: (id, sel) => {
      const el = id ? ws.querySelector(`[data-pane="${CSS.escape(id)}"]`) : null;
      return sel ? (el?.querySelector(sel) ?? null) : el;
    },
    point(el, press) {
      const c = cursor.current;
      if (!c) return;
      if (!el || reduced) {
        delete c.dataset.on;
        return;
      }
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
        driver.point(from);
        await clock.wait(700);
        driver.point(from, true);
        await clock.wait(260);
        // Held: the cursor follows each frame, without its own easing.
        if (cursor.current) cursor.current.dataset.drag = "";
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
      settle(store, cursor.current);
      // The release a person's drag makes (workspace/dnd.ts).
      if (d?.tabAt) store.actions.moveTab(pane, d.tabAt.index);
      else if (d?.target && d.zone) store.actions.drop(pane, d.target, d.zone);
      else return false;
      return true;
    },
    panel: showPanel,
    light(node) {
      hover(node);
      if (!node) return null;
      const line = ws
        .closest("figure")
        ?.querySelector<HTMLElement>(`.live-json [data-node="${CSS.escape(node)}"]`);
      const box = line?.closest<HTMLElement>(".live-json");
      if (line && box) {
        // Inside the JSON's own scroll only: the page stays where the reader left it.
        const top =
          box.scrollTop +
          line.getBoundingClientRect().top -
          box.getBoundingClientRect().top -
          box.clientHeight / 3;
        box.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
      }
      return line ?? null;
    },
  };
  return driver;
}
