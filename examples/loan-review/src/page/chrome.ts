/**
 * How much room the review gets: the queue at the left and the application's header can each be collapsed, to a slim
 * strip and to one line, so the views take the rest. The reader's own choice, like Single or Split: it stays in this
 * browser (a convenience; without storage it simply starts open) and never goes in a link.
 *
 * ⌘B collapses the queue, ⌘. both at once (focus); ⌘K has all three. Each has a button where it collapses. The keys
 * are the commands' own (`keys`), so Jali binds them, prints them in ⌘K and the tooltips, and lets the app rebind them.
 */
import { useSyncExternalStore } from "react";
import type { Command } from "jali-layout";

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

/** The commands' ids, for the tooltips that print their keys (`useJaliShortcut`). */
export const QUEUE_COMMAND = "loan-review.queue";

/** Below 768px the queue is a sheet, with nothing to collapse. */
const queueIsSheet = () => !matchMedia("(min-width: 768px)").matches;

/** In ⌘K, with their keys: with a modifier, so they never take a key someone is typing (WCAG 2.1.4). */
export const chromeCommands: Command[] = [
  {
    id: QUEUE_COMMAND,
    title: "Collapse or expand the queue",
    group: "Loan review",
    keys: "Mod+B",
    disabled: () => queueIsSheet() && "On a narrow window the queue is a sheet",
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
    title: "Focus on the review: collapse the queue and header",
    group: "Loan review",
    keys: "Mod+.",
    run: toggleFocus,
  },
];
