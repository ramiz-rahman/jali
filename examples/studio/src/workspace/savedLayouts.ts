/**
 * Each layout as the person left it, on this device. Jali asks for it when a layout is chosen (a preset's `saved`),
 * so moving from Mix to Edit and back brings Mix back as it was arranged. Reset (the slab's reset key, or ⌘K "Reset
 * this layout to its design") forgets it and lets Jali build the design again (presets.ts).
 */
import type { DeepReadonly, Jali, Layout } from "jali";
import { isRecord } from "@jali-examples/shared/store";
import { recordOf, saved } from "../storage";

const KEY = "studio:layouts:v1";
/** Where they were kept before the key had a version: the same shape. */
const UNVERSIONED = "studio:layouts";

/** The kept layouts, by preset id. Only an object can be a layout; Jali checks the rest of its shape before it uses
 *  one (a preset's `saved`), and builds the preset afresh from its design when it can't read it. */
export const readLayouts = (v: unknown): Record<string, DeepReadonly<Layout>> =>
  recordOf(v, (l) => (isRecord(l) ? (l as unknown as DeepReadonly<Layout>) : undefined));

export interface SavedLayouts {
  get(id: string): DeepReadonly<Layout> | undefined;
  /** Keep each layout as it changes. Returns the stop. */
  track(jali: Jali): () => void;
  /** The layout in use back to its design: forget how it was left, then let Jali rebuild it (it asks about unsaved
   *  work first). */
  reset(jali: Jali): ReturnType<Jali["actions"]["resetLayout"]>;
}

export function createSavedLayouts(persist = true): SavedLayouts {
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
    reset(jali) {
      const id = jali.get().presetId;
      if (id) {
        const { [id]: _forgotten, ...rest } = layouts;
        layouts = rest;
        write();
      }
      return jali.actions.resetLayout();
    },
  };
}
