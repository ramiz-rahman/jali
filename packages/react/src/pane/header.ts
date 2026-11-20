/**
 * The pane header's two adaptive parts: the slot where the pane's content puts its own controls (useHeaderActions), and
 * the measure that makes a narrow header give way before its title does.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/** One pane's header slot: the controls its content gave, and the element Jali places them in. */
export interface HeaderSlot {
  set(controls: ReactNode): void;
  /** The element in the header, as a callback ref. */
  target(el: HTMLElement | null): void;
  subscribe(fn: () => void): () => void;
  get(): { controls: ReactNode; el: HTMLElement | null };
}

export function createHeaderSlot(): HeaderSlot {
  let now: { controls: ReactNode; el: HTMLElement | null } = { controls: null, el: null };
  const subs = new Set<() => void>();
  const put = (next: Partial<typeof now>) => {
    const was = now;
    now = { ...now, ...next };
    if (was.controls !== now.controls || was.el !== now.el) for (const fn of subs) fn();
  };
  return {
    set: (controls) => put({ controls: controls ?? null }),
    target: (el) => put({ el }),
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    get: () => now,
  };
}

/** Whether the pane's content has given controls: the header draws the slot only then, so an empty one adds no gap. */
export function useHasHeaderControls(slot: HeaderSlot): boolean {
  return useSyncExternalStore(
    slot.subscribe,
    () => slot.get().controls != null && slot.get().controls !== false,
    () => false,
  );
}

/**
 * The content's controls, portalled into the header. Rendered beside the content, inside the pane's context, so the
 * pane's hooks work in them (as do providers above `<JaliRoot>`); providers inside the kind's component don't reach.
 */
export function HeaderControls({ slot }: { slot: HeaderSlot }) {
  const { controls, el } = useSyncExternalStore(slot.subscribe, slot.get, slot.get);
  return el && controls != null ? createPortal(controls, el) : null;
}

/** How far a narrow header has given way: 1, Jali's tuck, maximise, full screen and pop out moved into ⋯; 2, the app's controls hidden too. */
export type NarrowLevel = 0 | 1 | 2;

/** The shown title: the pane's own, or the shown tab's in a header that holds tabs. */
const TITLE = '.jali-pane-title h2, [role="tab"][aria-selected="true"] .jali-tab-title';
/** "A few characters": the title gives way below this many ems. */
const MIN_EMS = 3;
/** Room to spare before a narrow header takes its buttons back, so a width at the edge doesn't flicker. */
const SLACK = 8;

function fontSize(el: HTMLElement): number {
  const px = parseFloat(getComputedStyle(el).fontSize);
  return px > 0 ? px : 13;
}

/**
 * The header gives way a step at a time while its shown title is cut short below a few characters (`MIN_EMS`), up to
 * `max`. Each step remembers the header width at which the title would have its few characters back with the step
 * undone, and the header takes it back past that width. Measured, not a container query: what fits depends on the
 * title, the tabs and the buttons, not on one width.
 */
export function useNarrowHeader(ref: RefObject<HTMLElement | null>, max: NarrowLevel): NarrowLevel {
  const [level, setLevel] = useState<NarrowLevel>(0);
  const now = useRef<NarrowLevel>(0);
  const back = useRef<number[]>([]);
  const cap = useRef(max);
  cap.current = max;
  const watched = useRef<{ ro: ResizeObserver | null; title: Element | null }>({
    ro: null,
    title: null,
  });

  const check = useCallback(() => {
    const h = ref.current;
    if (!h) return;
    let at = Math.min(now.current, cap.current) as NarrowLevel;
    back.current.length = at;
    const w = h.clientWidth;
    const t = h.querySelector<HTMLElement>(TITLE);
    if (watched.current.title !== t) {
      if (watched.current.title) watched.current.ro?.unobserve(watched.current.title);
      if (t) watched.current.ro?.observe(t);
      watched.current.title = t;
    }
    if (at > 0 && w >= back.current[at - 1]!) {
      at = (at - 1) as NarrowLevel;
      back.current.length = at;
    } else if (t && at < cap.current) {
      const tw = t.clientWidth;
      const min = MIN_EMS * fontSize(t);
      if (t.scrollWidth > tw + 1 && tw < min) {
        back.current[at] = w + (min - tw) + SLACK;
        at = (at + 1) as NarrowLevel;
      }
    }
    if (at !== now.current) {
      now.current = at;
      setLevel(at);
    }
  }, [ref]);

  // After every render (a new title, tab or button), and whenever the header or the title changes size.
  useLayoutEffect(check);
  useEffect(() => {
    const h = ref.current;
    if (!h || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => check());
    watched.current = { ro, title: null };
    ro.observe(h);
    check();
    return () => {
      ro.disconnect();
      watched.current = { ro: null, title: null };
    };
  }, [ref, check]);

  return Math.min(level, max) as NarrowLevel;
}
