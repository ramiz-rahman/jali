/**
 * The slot in a pane's header where its content puts its own controls (useHeaderActions): the content renders them
 * beside itself, in the pane's context, and they are portalled into the header.
 */
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * One pane's header slot: the controls its content gave, and the element Jali places them in. Each caller of
 * useHeaderActions is an owner, named by its render order (`seq`, as the other report hooks are): the slot shows the
 * controls of the latest to render that has some. Mounted together, a child renders after its parent, so the innermost
 * call's show, as a title's do; one mounted later is later still. An owner that unmounts releases only its own, and the
 * one before shows again.
 */
export interface HeaderSlot {
  /** Give `seq`'s controls (`null`: none). */
  set(seq: number, controls: ReactNode): void;
  /** `seq` has gone: its controls with it. */
  release(seq: number): void;
  /** The element in the header, as a callback ref. */
  target(el: HTMLElement | null): void;
  subscribe(fn: () => void): () => void;
  get(): { controls: ReactNode; el: HTMLElement | null };
}

export function createHeaderSlot(): HeaderSlot {
  let now: { controls: ReactNode; el: HTMLElement | null } = { controls: null, el: null };
  /** Each owner's controls, by its render order. */
  const owners = new Map<number, ReactNode>();
  const subs = new Set<() => void>();
  const put = (next: Partial<typeof now>) => {
    const was = now;
    now = { ...now, ...next };
    if (was.controls !== now.controls || was.el !== now.el) for (const fn of subs) fn();
  };
  const shown = (): ReactNode => {
    const latest = Math.max(...[...owners].filter(([, c]) => c).map(([seq]) => seq));
    return owners.get(latest) ?? null;
  };
  return {
    set(seq, controls) {
      owners.set(seq, controls);
      put({ controls: shown() });
    },
    release(seq) {
      owners.delete(seq);
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
