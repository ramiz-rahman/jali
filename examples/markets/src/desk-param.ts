/**
 * Which desk is showing, kept in the address beside Jali's layout.
 *
 * Jali's link holds the layout (`l`), not the preset it was built from, so after a reload the workspace would think
 * it is on its first preset: the top bar would mark the wrong desk, and Reset layout would rebuild that one. The app
 * keeps the desk in a param of its own (`desk`), which Jali leaves alone, and gives it back on load and on Back.
 */
import type { Jali } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const PARAM = "desk";

export function keepDeskInAddress(jali: Jali): () => void {
  const restore = () => {
    const q = new URLSearchParams(window.location.search);
    const desk = q.get(PARAM);
    // Only with a layout in the address: a bare `?desk=` is not a link to a layout.
    if (
      desk &&
      q.has("l") &&
      jali.env.presets.some((p) => p.id === desk) &&
      jali.get().presetId !== desk
    )
      storeOf(jali).set({ presetId: desk });
  };
  restore();

  let shown = jali.get().presetId;
  const stop = jali.subscribe(() => {
    const id = jali.get().presetId;
    if (id === shown || !id) return;
    shown = id;
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, id);
    window.history.replaceState(window.history.state, "", url);
  });
  window.addEventListener("popstate", restore);
  return () => {
    stop();
    window.removeEventListener("popstate", restore);
  };
}
