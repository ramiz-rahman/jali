/**
 * Each layout as the person left it, on this device. Jali asks for it when a layout is chosen (a preset's `saved`),
 * so moving from Mix to Edit and back brings Mix back as it was arranged. Reset (the slab's reset key, or ⌘K "Reset
 * layout") puts the layout in use back to its design (presets.ts); this module forgets it too.
 */
import type { Jali, Layout } from "@jali/core";
import { saved } from "./store";
import { isRecord, recordOf } from "./stored";

const KEY = "studio:layouts:v1";
/** Where they were kept before the key had a version: the same shape. */
const UNVERSIONED = "studio:layouts";

/** The kept layouts, by preset id. Only an object can be a layout; Jali checks the rest of its shape before it uses
 *  one (a preset's `saved`), and builds the preset afresh from its design when it can't read it. */
export const readLayouts = (v: unknown): Record<string, Layout> =>
  recordOf(v, (l) => (isRecord(l) ? (l as unknown as Layout) : undefined));

export interface Layouts {
  get(id: string): Layout | undefined;
  /** Keep each layout as it changes. Returns the stop. */
  track(jali: Jali): () => void;
  /** Forget one layout's arrangement. */
  forget(id: string): void;
}

export function createLayouts(persist = true): Layouts {
  let layouts = persist ? saved.readVersioned(KEY, UNVERSIONED, readLayouts) : {};
  const write = () => persist && saved.write(KEY, layouts);
  return {
    get: (id) => (Object.hasOwn(layouts, id) ? layouts[id] : undefined),
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
