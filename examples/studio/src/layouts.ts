/**
 * Each layout as the person left it, on this device. Jali asks for it when a layout is chosen (a preset's `saved`),
 * so moving from Mix to Edit and back brings Mix back as it was arranged. Reset (the slab's reset key, or ⌘K "Reset
 * layout") puts the layout in use back to its design (presets.ts); this module forgets it too.
 */
import type { Jali, Layout } from "@jali/core";
import { saved } from "./store";

const KEY = "studio:layouts";

export interface Layouts {
  get(id: string): Layout | undefined;
  /** Keep each layout as it changes. Returns the stop. */
  track(jali: Jali): () => void;
  /** Forget one layout's arrangement. */
  forget(id: string): void;
}

export function createLayouts(persist = true): Layouts {
  let layouts: Record<string, Layout> = persist ? saved.read(KEY, {}) : {};
  const write = () => persist && saved.write(KEY, layouts);
  return {
    get: (id) => layouts[id],
    track: (jali) =>
      jali.on("layout", ({ layout }) => {
        const id = jali.get().presetId;
        if (!id) return;
        layouts = { ...layouts, [id]: layout };
        write();
      }),
    forget(id) {
      const { [id]: _gone, ...rest } = layouts;
      layouts = rest;
      write();
    },
  };
}
