/**
 * The layout-core instance. The pane cap lives inside layout-core (createLayoutCore({ paneCap })), so changing the
 * Settings cap swaps the instance; callers always go through `core`.
 */
import { createLayoutCore } from "../layout-core";
import type { LayoutCore } from "../layout-core/types";

let impl: LayoutCore = createLayoutCore({ paneCap: 8 });
let cap = 8;

export function setPaneCap(n: number) {
  if (n === cap) return;
  cap = n;
  impl = createLayoutCore({ paneCap: n });
}
export const paneCap = () => cap;

export const core: LayoutCore = new Proxy({} as LayoutCore, {
  get: (_t, k) => (impl as unknown as Record<PropertyKey, unknown>)[k],
});
