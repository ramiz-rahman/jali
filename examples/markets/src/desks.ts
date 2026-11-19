/**
 * Each desk as the person left it, on this device. Jali asks for it when a desk is chosen (a preset's `saved`), so
 * moving to Equities and back to Rates brings Rates back as it was arranged. Reset puts every desk back to the
 * demo's own layouts (presets.ts).
 */
import type { Jali, Layout } from "@jali/core";
import { saved } from "./store";

const KEY = "markets.desks";

export interface Desks {
  /** The layout a desk was left in, if it was changed. */
  get(id: string): Layout | undefined;
  /** Keep each desk's layout as it changes. Returns the stop. */
  track(jali: Jali): () => void;
  /** Forget every desk's layout but `keep`'s. */
  forget(keep?: string): void;
}

export function createDesks(persist = true): Desks {
  let layouts: Record<string, Layout> = persist ? saved.read(KEY, {}) : {};
  const write = () => persist && saved.write(KEY, layouts);
  return {
    get: (id) => layouts[id],
    track: (jali) =>
      jali.on("layout", ({ layout }) => {
        const desk = jali.get().presetId;
        if (!desk) return;
        layouts = { ...layouts, [desk]: layout };
        write();
      }),
    forget(keep) {
      layouts = keep && layouts[keep] ? { [keep]: layouts[keep] } : {};
      write();
    },
  };
}
