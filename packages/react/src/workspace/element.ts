/**
 * The panes' element in the page: its usable size, direction and fold (measured into the core, `store.measure`), and
 * whether the person is in the instance.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  directionOf,
  hingeOf,
  observeResize,
  watchDirection,
  type JaliStore,
} from "@jali/core/adapter";
import { useHydrated } from "../state/hydrated";
import { paneHydration } from "../state/hydration";

// Development checks test the literal, so a production build drops them and their messages (dev.ts).
declare const process: { env: { NODE_ENV?: string } };

/** The instance's usable size follows the element (minus the inset), and so does its reading direction (an
 *  ancestor's `dir`, read again when any `dir` on the page changes), unless the instance was given one.
 *  An instance that hydrates a server's HTML measures once its panes have hydrated (state/hydration.ts). */
export function useMeasure(store: JaliStore) {
  const ref = useRef<HTMLElement>(null);
  // Whether this mount hydrates a server's HTML: read on the first render, and kept.
  const hydrated = useHydrated();
  const hydrating = useRef(!hydrated).current;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { inset } = store.env.spacing;
    let held = hydrating;
    const measure = () => {
      if (held) return;
      const width = Math.max(0, Math.floor(el.clientWidth - inset * 2)),
        height = Math.max(0, Math.floor(el.clientHeight - inset * 2));
      // A fold across the layout, from the browser's viewport segments (Chrome and Edge 138+; none elsewhere).
      const segments = (window as { viewport?: { segments?: DOMRect[] | null } }).viewport
        ?.segments;
      store.measure({
        area: { width, height },
        dir: directionOf(store.env.dir, el),
        hinge: hingeOf(segments ?? undefined, el.getBoundingClientRect()),
      });
    };
    const cancelHold = held
      ? paneHydration(store).whenSettled(() => {
          held = false;
          measure();
        })
      : undefined;
    measure();
    try {
      if (process.env.NODE_ENV !== "production" && el.clientWidth > 0 && el.clientHeight === 0)
        console.warn(
          "Jali: the panes measure 0 pixels high, so every pane is collapsed. Give <JaliRoot> (or the element " +
            "around <JaliView />) a height, or make it a flex or grid cell that has one.",
          el,
        );
    } catch {
      /* no `process`: production */
    }
    const unobserve = observeResize(el, measure);
    const unwatch = watchDirection(measure);
    // Folding and unfolding changes the segments, sometimes without changing the element's size.
    window.addEventListener("resize", measure);
    const posture = (navigator as { devicePosture?: EventTarget }).devicePosture;
    posture?.addEventListener("change", measure);
    // A fold that turns from book to tabletop changes the segments alone: their media queries say so.
    const folds = ["(horizontal-viewport-segments: 2)", "(vertical-viewport-segments: 2)"].map(
      (q) => window.matchMedia?.(q),
    );
    folds.forEach((q) => q?.addEventListener?.("change", measure));
    return () => {
      cancelHold?.();
      unobserve();
      unwatch();
      window.removeEventListener("resize", measure);
      posture?.removeEventListener("change", measure);
      folds.forEach((q) => q?.removeEventListener?.("change", measure));
    };
  }, [store]);
  return ref;
}

/** Whether the person was last in this instance (focus or a press inside its root, its dialogs or a surface such as Pop
 *  out's window), not elsewhere on the page. Starts false: mounting an instance is not the person going there. */
export function useEngaged(store: JaliStore) {
  const engaged = useRef(false);
  useEffect(() => {
    const on = (e: Event) => {
      const t = e.target as Node | null;
      engaged.current = !!t && store.dom.contains(t);
    };
    const listen = (doc: Document) => {
      doc.addEventListener("focusin", on, true);
      doc.addEventListener("pointerdown", on, true);
      return () => {
        doc.removeEventListener("focusin", on, true);
        doc.removeEventListener("pointerdown", on, true);
      };
    };
    const offPage = listen(document);
    const offSurfaces = store.dom.eachSurface((el) =>
      el.ownerDocument !== document ? listen(el.ownerDocument) : undefined,
    );
    return () => {
      offSurfaces();
      offPage();
    };
  }, [store]);
  return engaged;
}
