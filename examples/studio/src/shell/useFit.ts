/**
 * How the top bar's slab gives way: by the room it has, measured, never by guessed window widths. Each step
 * (`data-f1` to `data-f11` on the slab, cumulative, which shell.css reads) takes something out or tightens something,
 * in a fixed order; on every resize, and once the fonts have loaded, the slab starts from nothing taken away and takes
 * steps until its content fits. So two parts can never overlap or overflow, at any width, zoom or font. Steps, in
 * order:
 *
 *   1 the scrub dial's "10 s/turn" note, and narrower dial caps   7 the scrub dial
 *   2 tighter gaps and padding, slightly narrower keys            8 the loop and link keys
 *   3 a narrower display                                          9 the stop key; slightly shorter keys
 *   4 the speed dial                                              10 two tiers (a phone)
 *   5 the studio name                                             11 the stop key again, in two tiers
 *   6 the four layout keys fold into one menu key
 */
import { useLayoutEffect, useRef } from "react";

const STEPS = 11;

/** The ref for the slab. */
export function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (level: number) => {
      for (let i = 1; i <= STEPS; i++) el.toggleAttribute(`data-f${i}`, i <= level);
    };
    const fits = () => el.scrollWidth <= el.clientWidth + 0.5;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      let level = 0;
      set(0);
      while (level < STEPS && !fits()) set(++level);
      el.dataset.fit = String(level);
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            frame = requestAnimationFrame(measure);
          })
        : null;
    ro?.observe(el);
    void document.fonts?.ready.then(measure);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}
