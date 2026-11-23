/**
 * The slot in a pane's header where its content puts its own controls (useHeaderActions): the content renders them
 * beside itself, in the pane's context, and they are portalled into the header.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * One pane's header slot: the controls its content gave, and the element Jali places them in. Each caller of
 * useHeaderActions is an owner: the slot shows the controls of the latest owner to register that has some, and an
 * owner that unmounts releases only its own, so the one before shows again.
 */
export interface HeaderSlot {
  /** Give `owner`'s controls (`null`: none). The first call from an owner makes it the latest. */
  set(owner: object | string, controls: ReactNode): void;
  /** `owner` has gone: its controls with it. */
  release(owner: object | string): void;
  /** The element in the header, as a callback ref. */
  target(el: HTMLElement | null): void;
  subscribe(fn: () => void): () => void;
  get(): { controls: ReactNode; el: HTMLElement | null };
}

export function createHeaderSlot(): HeaderSlot {
  let now: { controls: ReactNode; el: HTMLElement | null } = { controls: null, el: null };
  /** Owners in the order they registered: the last with controls is shown. */
  const owners = new Map<object | string, ReactNode>();
  const subs = new Set<() => void>();
  const put = (next: Partial<typeof now>) => {
    const was = now;
    now = { ...now, ...next };
    if (was.controls !== now.controls || was.el !== now.el) for (const fn of subs) fn();
  };
  const shown = (): ReactNode => {
    let controls: ReactNode = null;
    for (const c of owners.values()) controls = c || controls;
    return controls;
  };
  return {
    set(owner, controls) {
      owners.set(owner, controls);
      put({ controls: shown() });
    },
    release(owner) {
      owners.delete(owner);
      put({ controls: shown() });
    },
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
