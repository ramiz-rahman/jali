import type { FitOptions, KindRegistry, Layout, LayoutNode, PaneNode, ViewState } from "./types";

export const kinds: KindRegistry = Object.fromEntries([
  ["list", 320, 120], ["record", 480, 200], ["inspector", 280, 100], ["small", 100, 80], ["wide", 640, 240],
].map(([kind, minWidth, minHeight]) => [kind, { kind, minWidth, minHeight, title: () => String(kind) }])) as KindRegistry;
export const pane = (id: string, kind = "small", overrides: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", ref: { kind, params: { id } }, size: { weight: 1 }, ...overrides });
export const layout = (...children: LayoutNode[]): Layout => ({ version: 1, root: children.length === 1 ? children[0]! : { id: "root", type: "row", size: { weight: 1 }, children } });
export const view = (focused = "a", history = [focused]): ViewState => ({ focused, focusHistory: history });
export const fit = (width = 1440, height = 900): FitOptions => ({ width, height, gap: 6, kinds });
export const ref = (kind = "record", id: string | number = 1) => ({ kind, params: { id } });
export function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
