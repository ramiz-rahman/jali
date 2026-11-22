/**
 * The slot in a pane's header where its content puts its own controls (useHeaderActions): the content renders them
 * beside itself, in the pane's context, and they are portalled into the header.
 */
import { useSyncExternalStore, type ReactNode } from "react";
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
