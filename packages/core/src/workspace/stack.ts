/**
 * Stacked view, on a portrait phone (`createJali({ phone: { stack: true } })`): in place of Single view, two linked
 * panes, one above the other, such as a list above its detail. The pair is the focused pane and the pane it was
 * opened from, else one opened from it. Never more than two, only with height for both, and a kind can stay out
 * (`phone: { stack: false }`) or ask for its half (`phone: { place: "top" | "bottom" }`). Derived each render, like
 * Single view: the layout, the address and history don't change. Pure.
 */
import type { NodeId, PaneNode, ViewState } from "../layout/types";
import { DEFAULT_MIN_HEIGHT } from "../pane-kinds";
import type { Env } from "../profile";
import { SWITCHER_H } from "../tokens";
import { shares } from "../layout/geometry/shares";

/** Below this workspace height, never stacked (Android's compact height: a phone held sideways). */
export const STACK_MIN_HEIGHT = 480;
/** The shortest a stacked pane may be, unless its kind asks for more. */
export const STACK_FLOOR = 200;

export interface StackPair {
  /** Above, or (side by side, `axis: "row"`) at the start. */
  top: NodeId;
  /** Below, or at the end. */
  bottom: NodeId;
  /** `column` (default): one above the other; `row`: side by side, either side of a fold. */
  axis?: "row" | "column";
  /** Across a fold: where the hinge is, which the divider sits on and nobody moves. */
  hinge?: Hinge;
}

/**
 * A fold that separates the screen into two (a half-open Galaxy Fold or Pixel Fold, a Flip in flex mode, a spanned
 * Surface Duo), from the browser's viewport segments, in the workspace's own coordinates: `axis: "row"` when the two
 * halves are side by side (the hinge runs down), `"column"` when one is above the other. `start` and `size` place the
 * hinge along that axis (`size` 0 for a seamless fold, the mask's width for a dual screen).
 */
export interface Hinge {
  axis: "row" | "column";
  start: number;
  size: number;
}

/**
 * Across a fold: two panes, one each side, so nothing straddles the hinge. The pair is the focused pane and its
 * partner, else the next pane on screen; one pane alone spans both halves. Not for kinds that stay out of stacking.
 */
export function foldPair(input: {
  env: Env;
  hinge: Hinge;
  onScreen: PaneNode[];
  current: NodeId | undefined;
}): StackPair | undefined {
  const { env, hinge, onScreen, current } = input;
  if (env.phone?.fold === false || !current) return undefined;
  const byId = new Map(onScreen.map((p) => [p.id, p]));
  const pane = byId.get(current);
  if (!pane) return undefined;
  const source = pane.linkedTo ? byId.get(pane.linkedTo) : undefined;
  const opened = onScreen.filter((p) => p.linkedTo === pane.id);
  const i = onScreen.indexOf(pane);
  const partner =
    source ?? opened.find((p) => p.follows) ?? opened[0] ?? onScreen[i + 1] ?? onScreen[i - 1];
  if (!partner) return undefined;
  const ahead = source || onScreen.indexOf(partner) < i;
  let [top, bottom] = ahead ? [partner, pane] : [pane, partner];
  const hint = (p: PaneNode) => env.kinds.get(p.ref.kind)?.phone;
  if (hint(top)?.place === "bottom" || hint(bottom)?.place === "top") [top, bottom] = [bottom, top];
  return { top: top.id, bottom: bottom.id, axis: hinge.axis, hinge };
}

export function stackPair(input: {
  env: Env;
  view: ViewState;
  area: { width: number; height: number };
  /** The panes Single view switches between (not hidden), in tree order. */
  onScreen: PaneNode[];
  /** The pane Single view would show. */
  current: NodeId | undefined;
}): StackPair | undefined {
  const { env, area, onScreen, current } = input;
  const phone = env.phone;
  if (!phone?.stack || !current || area.height < STACK_MIN_HEIGHT) return undefined;
  const byId = new Map(onScreen.map((p) => [p.id, p]));
  const pane = byId.get(current);
  if (!pane) return undefined;
  const source = pane.linkedTo ? byId.get(pane.linkedTo) : undefined;
  const opened = onScreen.filter((p) => p.linkedTo === pane.id);
  const partner = source ?? opened.find((p) => p.follows) ?? opened[0];
  if (!partner) return undefined;
  const hint = (p: PaneNode) => env.kinds.get(p.ref.kind)?.phone;
  if (hint(pane)?.stack === false || hint(partner)?.stack === false) return undefined;
  // Each half, after the switcher and the gap between them, must hold the taller of the floor and the kind's minimum.
  const half = (area.height - SWITCHER_H) / 2;
  const floor = (p: PaneNode) =>
    Math.max(
      phone.stackFloor ?? STACK_FLOOR,
      env.kinds.get(p.ref.kind)?.height?.min ?? DEFAULT_MIN_HEIGHT,
    );
  if (half < floor(pane) || half < floor(partner)) return undefined;
  // The pane others were opened from goes above, unless a kind asks otherwise.
  let [top, bottom] = source ? [partner, pane] : [pane, partner];
  if (hint(top)?.place === "bottom" || hint(bottom)?.place === "top") [top, bottom] = [bottom, top];
  return { top: top.id, bottom: bottom.id };
}

/**
 * The top pane's share of stacked view's height (0 to 1) until the person moves the divider: the two panes share the
 * height as a column does, from each kind's `height` (its minimum, or the floor, then its comfortable height, then
 * its max; spare room past a max goes to the other pane). With neither kind giving a comfortable or max height, a
 * half.
 */
export function stackShare(
  env: Env,
  top: PaneNode | undefined,
  bottom: PaneNode | undefined,
  height: number,
  gap: number,
): number {
  const room = height - gap;
  if (room <= 0) return 0.5;
  const floor = env.phone?.stackFloor ?? STACK_FLOOR;
  const item = (p: PaneNode | undefined) => {
    const h = p ? env.kinds.get(p.ref.kind)?.height : undefined;
    return {
      size: { weight: 1 },
      min: Math.max(floor, h?.min ?? DEFAULT_MIN_HEIGHT),
      comfortable: h?.comfortable,
      max: h?.max,
    };
  };
  const [above] = shares([item(top), item(bottom)], room);
  return Math.min(1, Math.max(0, above! / room));
}

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * The hinge two viewport segments make across `box` (the workspace element's client rect), in the box's coordinates,
 * or undefined: no fold, more than two segments, or a fold that misses the box or only grazes its edge (within 48px),
 * where a split would leave a sliver.
 */
export function hingeOf(segments: readonly Box[] | undefined, box: Box): Hinge | undefined {
  if (!segments || segments.length !== 2) return undefined;
  const [a, b] = segments as [Box, Box];
  const EDGE = 48;
  if (a.right <= b.left && box.left + EDGE < a.right && b.left < box.right - EDGE)
    return { axis: "row", start: a.right - box.left, size: b.left - a.right };
  if (a.bottom <= b.top && box.top + EDGE < a.bottom && b.top < box.bottom - EDGE)
    return { axis: "column", start: a.bottom - box.top, size: b.top - a.bottom };
  return undefined;
}

export const sameHinge = (a: Hinge | undefined, b: Hinge | undefined) =>
  a === b || (!!a && !!b && a.axis === b.axis && a.start === b.start && a.size === b.size);
