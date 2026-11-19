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

/** Below this workspace height, never stacked (Android's compact height: a phone held sideways). */
export const STACK_MIN_HEIGHT = 480;
/** The shortest a stacked pane may be, unless its kind asks for more. */
export const STACK_FLOOR = 200;

export interface StackPair {
  top: NodeId;
  bottom: NodeId;
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
