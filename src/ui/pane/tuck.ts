import type { ShelfEntry } from "../../layout-core/types";
import { actions, shelfEntries, titleOf, tuckHome, useUi } from "../store";

/** One tucked pane as the shelf shows it (ShelfEntry from layout-core, with activity from the store). */
export type ShelfItem = ShelfEntry;

/** The shelf UI shows tucked panes only; ResolvedLayout.shelf also lists folded panes and inactive tabs (DECISIONS, 17 Nov). */
export function useShelf(): ShelfItem[] {
  useUi((s) => s.layout);
  useUi((s) => s.area);
  useUi((s) => s.activity);
  return shelfEntries().filter((e) => e.reason === "tucked");
}

/** Whether a pane can be tucked now, and the pane it would join. */
export function useTuck(id: string): { can: boolean; homeTitle: string | undefined } {
  useUi((s) => s.layout);
  useUi((s) => s.area);
  const homeId = tuckHome(id);
  return { can: !!homeId, homeTitle: homeId ? titleOf(homeId) : undefined };
}

export const tuck = (id: string) => actions.tuck(id);
export const putBack = (id: string) => actions.putBack(id);
export const reveal = (id: string) => actions.reveal(id);

/** A 600ms highlight on a tab, so the eye finds where a revealed pane went. Skipped under reduced motion. */
export function flashTab(paneId: string) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[role="tab"][data-tab="${paneId}"]`);
    if (!el) return;
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 600);
  });
}

/** Dev-only handle so e2e can drive activity states (the sample panes rarely report them). */
if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV && typeof window !== "undefined") (window as unknown as { __lab?: unknown }).__lab = { actions };
