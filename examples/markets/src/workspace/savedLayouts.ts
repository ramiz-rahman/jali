/**
 * Each desk as the person left it, on this device. Jali asks for it when a desk is chosen (a preset's `saved`), so
 * moving to Equities and back to Rates brings Rates back as it was arranged. Reset puts every desk back to the
 * demo's own layouts (presets.ts).
 *
 * What is kept is only checked for its outline here (an object of layouts by desk id): Jali reads each layout itself
 * when the desk is chosen, and builds the desk's own when it can't.
 */
import type { DeepReadonly, Jali, Layout } from "jali";
import { isRecord, readKept, writeKept, type Kept } from "@jali-examples/shared/store";

type Layouts = Readonly<Record<string, DeepReadonly<Layout>>>;

/** Version 1; 0 is the same shape, from before versions. */
export const KEPT_LAYOUTS: Kept<Layouts> = {
  key: "markets.desks",
  version: 1,
  fallback: {},
  parse(value, version) {
    if (version > 1 || !isRecord(value)) return undefined;
    const out: Record<string, DeepReadonly<Layout>> = {};
    for (const [id, layout] of Object.entries(value))
      if (isRecord(layout)) out[id] = layout as unknown as DeepReadonly<Layout>;
    return out;
  },
};

export interface SavedLayouts {
  /** The layout a desk was left in, if it was changed. */
  get(desk: string): DeepReadonly<Layout> | undefined;
  /** Keep each desk's layout as it changes. Returns the stop. */
  track(jali: Jali): () => void;
  /**
   * Every desk back to the demo's layout. The desk on screen goes back through Jali, which first asks the app about
   * work that would be lost (a typed order: unsent.ts); the others are forgotten only once that has happened, so
   * "Keep the order" keeps them all.
   */
  resetAll(jali: Jali): void;
}

export function createSavedLayouts(persist = true): SavedLayouts {
  let layouts: Layouts = persist ? readKept(KEPT_LAYOUTS) : {};
  const own = (desk: string) => (Object.hasOwn(layouts, desk) ? layouts[desk] : undefined);
  const keep = (next: Layouts) => {
    layouts = next;
    if (persist) writeKept(KEPT_LAYOUTS, layouts);
  };
  /** Forget every desk's layout but the one on screen's. */
  const forgetAllBut = (desk: string | undefined) => {
    const layout = desk === undefined ? undefined : own(desk);
    keep(desk !== undefined && layout ? { [desk]: layout } : {});
  };
  return {
    get: own,
    track: (jali) =>
      jali.on("layout", ({ layout }) => {
        const desk = jali.get().presetId;
        if (desk) keep({ ...layouts, [desk]: layout });
      }),
    resetAll(jali) {
      const desk = jali.get().presetId;
      const result = jali.actions.resetLayout();
      if (result.ok) return forgetAllBut(desk);
      // The app asked about unsent work: forget the other desks only if the person discards and the reset lands.
      void result.settled?.then((end) => end.ok && forgetAllBut(desk));
    },
  };
}
