/**
 * Which field is lit, shared by the dissection tree and the hex view of the same packet: select a field and its
 * bytes light up; point at a byte and its field does. Transient by design, so it lives here and not in the address
 * or pane state: a reload starts with nothing lit.
 */
import { createStore } from "#src/store.ts";

export interface Highlight {
  /** `capture:n`, so a hex view of another packet ignores it. */
  key: string;
  field: string | null;
}

export const highlightStore = createStore<Highlight>({ key: "", field: null });

export const highlightKey = (capture: string, n: number) => `${capture}:${n}`;

export function setHighlight(key: string, field: string | null) {
  const now = highlightStore.get();
  if (now.key !== key || now.field !== field) highlightStore.set({ key, field });
}
