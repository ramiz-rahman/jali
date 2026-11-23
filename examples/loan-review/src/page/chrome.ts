/**
 * How much room the review gets: the queue at the left and the application's header can each be collapsed, to a slim
 * strip and to one line, so the views take the rest. The reader's own choice, like Single or Split: it stays in this
 * browser (a convenience; without storage it simply starts open) and never goes in a link.
 *
 * ⌘B collapses the queue, ⌘. both at once (focus); ⌘K has all three. Each has a button where it collapses.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { Command } from "jali";

export interface Chrome {
  /** The queue is a slim strip. */
  queue: boolean;
  /** The header is one line. */
  header: boolean;
}

const KEY = "loan-review:collapsed";
const OPEN: Chrome = { queue: false, header: false };

function load(): Chrome {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Chrome> | null;
    return { queue: v?.queue === true, header: v?.header === true };
  } catch {
    return OPEN;
  }
}

let state = load();
const listeners = new Set<() => void>();

function set(next: Chrome) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // No storage: the choice lasts until the page reloads.
  }
  listeners.forEach((l) => l());
}

export const toggleQueue = () => set({ ...state, queue: !state.queue });
export const toggleHeader = () => set({ ...state, header: !state.header });
/** Focus: both collapsed, or, when both already are, both open again. */
export const toggleFocus = () => {
  const both = state.queue && state.header;
  set({ queue: !both, header: !both });
};

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const useChrome = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => OPEN,
  );

/** The keys, in the tooltips as on the keyboard. */
const MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);
export const KEYS = { queue: MAC ? "⌘B" : "Ctrl+B", focus: MAC ? "⌘." : "Ctrl+." } as const;

/** ⌘B and ⌘.: with a modifier, so they never take a key someone is typing (WCAG 2.1.4). Mounted once, by the header. */
export function useChromeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey || e.repeat) return;
      if (e.key === "b" || e.key === "B") {
        // Below 768px the queue is a sheet, with nothing to collapse.
        if (!matchMedia("(min-width: 768px)").matches) return;
        toggleQueue();
      } else if (e.key === ".") toggleFocus();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** The same, in ⌘K. */
export const chromeCommands: Command[] = [
  {
    id: "loan-review.queue",
    title: `Collapse or expand the queue (${KEYS.queue})`,
    group: "Loan review",
    run: toggleQueue,
  },
  {
    id: "loan-review.header",
    title: "Collapse or expand the application's header",
    group: "Loan review",
    run: toggleHeader,
  },
  {
    id: "loan-review.focus",
    title: `Focus on the review: collapse the queue and header (${KEYS.focus})`,
    group: "Loan review",
    run: toggleFocus,
  },
];
