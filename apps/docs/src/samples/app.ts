/**
 * A stand-in for the reader's own app, for the short code blocks on the docs pages. tooling/docs-check.mjs resolves a
 * block's relative imports (`./panes`, `./chart-view`) here, so a block can import from "its" app and still be
 * typechecked. Never shown on the site.
 */
import type { ComponentType } from "react";
import type { LayoutInput, PresetOptions } from "jali";
import { definePane, type PaneProps } from "jali/react";
import { presets as orderPresets } from "./guides/presets/layouts";
import { orderKinds as kinds } from "./guides/pane-kinds/orders";

export { routerLocation } from "./guides/url/router-location";

const view = (): null => null;
/** The app's components, as a pane's `Component` takes them. */
export const Chart: ComponentType<PaneProps<any>> = view;
export const Watchlist: ComponentType<PaneProps<any>> = view;
export const NoteList: ComponentType<{ notes?: unknown[] }> = view;

export const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: view,
});
export const customer = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => `Customer ${id}`,
  Component: view,
});
export const orderKinds = kinds;
export const panes = [...kinds, customer];
export const presets: readonly PresetOptions[] = orderPresets;
export const launcher = definePane("launcher", {
  title: "New pane",
  scratch: true,
  Component: view,
});

export const OrderDetail: ComponentType<PaneProps<{ id: number }>> = view;
export { orderKind } from "./guides/pane-kinds/orders";
export const telemetry = { report: (_error: unknown, _context?: object): void => {} };
export const useAddNote = () => (): void => {};
export const refresh = (): void => {};
export const library = definePane("library", { title: "Library", Component: view });
export const Session: ComponentType<{ session: { id: string } }> = view;
export const useSession = (_id: string): { id: string } | undefined => undefined;
export const user = { id: "u1" };
export const api = {
  loadLayout: async (_user: string): Promise<LayoutInput | null> => null,
  saveLayout: async (_user: string, _layout: unknown): Promise<void> => {},
};
export const forgetSavedLayouts = (): void => {};
export const drafts = { for: async (_refs: unknown[]): Promise<string[]> => [] };
export const askToSave = async (_panes: unknown[]): Promise<boolean> => true;
export { stageKind as stage } from "./guides/scrolling-rows/board";
