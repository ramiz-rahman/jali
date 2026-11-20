/**
 * Each desk as the person left it, on this device. Jali asks for it when a desk is chosen (a preset's `saved`), so
 * moving to Equities and back to Rates brings Rates back as it was arranged. Reset puts every desk back to the
 * demo's own layouts (presets.ts).
 *
 * What is kept is only checked for its outline here (an object of layouts by desk id): Jali reads each layout itself
 * when the desk is chosen, and builds the desk's own when it can't.
 */
import type { Jali, Layout } from "@jali/core";
import { isRecord, readKept, writeKept, type Kept } from "#shared/store";

type Layouts = Readonly<Record<string, Layout>>;

/** Version 1; 0 is the same shape, from before versions. */
export const KEPT_DESKS: Kept<Layouts> = {
  key: "markets.desks",
  version: 1,
  fallback: {},
  parse(value, version) {
    if (version > 1 || !isRecord(value)) return undefined;
    const out: Record<string, Layout> = {};
    for (const [id, layout] of Object.entries(value))
      if (isRecord(layout)) out[id] = layout as unknown as Layout;
    return out;
  },
};

export interface Desks {
  /** The layout a desk was left in, if it was changed. */
  get(id: string): Layout | undefined;
  /** Keep each desk's layout as it changes. Returns the stop. */
  track(jali: Jali): () => void;
  /**
   * Every desk back to the demo's layout. The desk on screen goes back through Jali, which first asks about work that
   * would be lost (a typed order); the others are forgotten only once that has happened, so "Keep editing" keeps
   * them all.
   */
  resetAll(jali: Jali): void;
}

export function createDesks(persist = true): Desks {
  let layouts: Layouts = persist ? readKept(KEPT_DESKS) : {};
  const write = () => persist && writeKept(KEPT_DESKS, layouts);
  /** Forget every desk's layout but `keep`'s. */
  const forget = (keep: string | undefined) => {
    const kept = keep !== undefined && Object.hasOwn(layouts, keep) ? layouts[keep] : undefined;
    layouts = keep !== undefined && kept ? { [keep]: kept } : {};
    write();
  };
  return {
    get: (id) => (Object.hasOwn(layouts, id) ? layouts[id] : undefined),
    track: (jali) =>
      jali.on("layout", ({ layout }) => {
        const desk = jali.get().presetId;
        if (!desk) return;
        layouts = { ...layouts, [desk]: layout };
        write();
      }),
    resetAll(jali) {
      const desk = jali.get().presetId;
      const result = jali.actions.resetLayout();
      if (result.ok) return forget(desk);
      // Jali asked about unsaved work: forget the other desks only if the person discards and the reset lands.
      void result.settled?.then((end) => end.ok && forget(desk));
    },
  };
}
