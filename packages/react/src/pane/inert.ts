import { useCallback } from "react";

/**
 * A ref that makes its element inert while `on`: out of the tab order, the accessibility tree and the pointer. Set as
 * the DOM property rather than the `inert` prop, because React 18 drops an `inert` it doesn't know, and React 19
 * reads `inert=""` as false. The same in both.
 */
export function useInert(on: boolean) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (el) el.inert = on;
    },
    [on],
  );
}
