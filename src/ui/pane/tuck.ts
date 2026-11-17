import { actions, findPane, resolved, titleOf, useUi } from "../store";
import * as store from "../store";
import { paneTitle } from "../pane-kinds";

/** One tucked pane as the shelf shows it. Mirrors ResolvedLayout.shelf. */
export interface ShelfItem { paneId: string; homeId: string; reason?: string; activity?: string }

type Loose = {
  canTuck?: (id: string) => boolean | { ok: boolean; home?: string };
  tuckHome?: (id: string) => string | undefined;
};
const api = store as unknown as Loose;

/** The shelf entries from the resolved layout; empty when nothing is tucked. */
export function useShelf(): ShelfItem[] {
  useUi((s) => s.layout);
  useUi((s) => s.area);
  return ((resolved() as unknown as { shelf?: ShelfItem[] }).shelf ?? []).slice();
}

/** Whether a pane can be tucked now, and the pane it would join. */
export function useTuck(id: string): { can: boolean; homeTitle: string | undefined } {
  useUi((s) => s.layout);
  const r = api.canTuck?.(id);
  const can = typeof r === "object" ? !!r?.ok : !!r;
  const homeId = typeof r === "object" ? r?.home : api.tuckHome?.(id);
  const home = homeId ? findPane(homeId) : undefined;
  return { can, homeTitle: home ? paneTitle(home.ref) : homeId ? titleOf(homeId) : undefined };
}

export const tuck = (id: string) => (actions as unknown as { tuck: (id: string) => void }).tuck(id);
export const putBack = (id: string) => (actions as unknown as { putBack: (id: string) => void }).putBack(id);
export const reveal = (id: string) => (actions as unknown as { reveal: (id: string) => void }).reveal(id);

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
