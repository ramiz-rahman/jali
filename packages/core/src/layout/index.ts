/** Pure public API. Structural operations own fitting; refit handles external size/cap/link events. */
export type * from "./types";
export * as tree from "./tree/public";
export { open, openBeside, split, type Placement, type OpenOptions } from "./ops/open";
export { close, closeOthers } from "./ops/close";
export { swap, drop, moveDirection, moveOutOfStrip } from "./ops/move";
export { resizeDivider, resetDivider } from "./ops/divider";
export { canTuck, tuck, putBack, putBackEdge } from "./ops/tuck";
export { hide, show } from "./ops/hide";
export { replace } from "./ops/replace";
export { arrange, type ArrangeOptions } from "./ops/arrange";
export { setRef } from "./ops/ref";
export { follow, follower, followers, selectionLink, setKept } from "./ops/follow";
export { addTab, moveTab, reveal, setActiveTab, setPinned, resetLayout } from "./ops/tabs";
export { focus, focusCycle, focusDirection, toggleZoom } from "./ops/focus";
export { snapToCentre, SNAP_IN, SNAP_OUT } from "./geometry/snap";
export { extentAlong, extentIn } from "./geometry/extent";
export { minSize } from "./geometry/bounds";
export {
  scrolled,
  offsetToShow,
  clampOffset,
  maxOffset,
  inWindow,
  type Offsets,
} from "./geometry/scroll";
import { resolve as resolveDraft } from "./fit/resolve";
import { encode as encodeDraft } from "./codec/codec";
import { validate as validateDraft } from "./codec/validate";
import type { DeepReadonly, Layout } from "./types";
/** Where every pane goes in the room there is: boxes, dividers, groups and the shelf. Takes a layout a workspace gave. */
export const resolve = resolveDraft as (
  layout: DeepReadonly<Layout>,
  ...rest: Parameters<typeof resolveDraft> extends [unknown, ...infer R] ? R : never
) => ReturnType<typeof resolveDraft>;
export { refit } from "./fit/refit";
export { decode } from "./codec/codec";
/** A layout as the text a link carries. Takes a layout a workspace gave. */
export const encode = encodeDraft as (layout: DeepReadonly<Layout>) => string;
/** Whether a layout can be shown with these kinds, and what is wrong when not. Takes a layout a workspace gave. */
export const validate = validateDraft as (
  layout: DeepReadonly<Layout>,
  ...rest: Parameters<typeof validateDraft> extends [unknown, ...infer R] ? R : never
) => ReturnType<typeof validateDraft>;
