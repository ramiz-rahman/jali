/**
 * Explicit start-up. `boot` puts the first state in place before the first render (so the first paint is the shared
 * layout); `startUi` installs the page-lifetime listeners: keyboard, Back/Forward, theme, settings persistence.
 */
import * as core from "../layout-core";
import { installKeyboard } from "./commands/keyboard";
import { kindRegistry } from "./pane-kinds";
import { presetById } from "./presets";
import { msg, toasts } from "./state/messages";
import { applyTheme, resolveTheme, saveSettings, watchSystemTheme } from "./state/settings";
import type { UiStore } from "./state/store";
import { applyTokens } from "./tokens";
import { getProfile } from "./profile";
import { adjustKey, adjustmentsOf, saveAdjustments } from "./state/adjustments";
import type { UrlSync } from "./url";

/** Apply the URL to the store (first load, Back/Forward). A link that can't be read opens the current preset. */
function arriveFromUrl(store: UiStore, url: UrlSync): boolean {
  const r = url.read(kindRegistry());
  if (!r) return false;
  if ("review" in r) {
    const { arrangement, item, investigation } = r.review;
    store.actions.enterReview({ arrangement: arrangement || undefined, item: item || undefined, investigation, fromUrl: true, view: r.view });
  } else if ("broken" in r) {
    store.actions.arrive(presetById(store.get().presetId).build(), r.view);
    url.keepBroken(r.broken);
    store.writeUrl("replace");
    store.toast(toasts.brokenLink(presetById(store.get().presetId).label));
    store.announce(msg.brokenLink);
  } else store.actions.arrive(r.layout, r.view);
  return true;
}

export function boot(store: UiStore, url: UrlSync) {
  arriveFromUrl(store, url);
  const panes = () => core.tree.panes(store.get().layout.root);
  store.actions.noteOpen(panes().map((p) => p.ref));
  const s = store.get();
  const layout = core.refit(s.layout, s.view, store.ctx());
  const first = panes()[0]?.id;
  store.set({ layout, ...(!s.view.focused && first ? { view: { ...s.view, focused: first, focusHistory: [first] } } : {}) });
  store.writeUrl("replace");
}

/** Listeners for the life of the page. Returns a function that removes them (tests, HMR). */
export function startUi(store: UiStore, url: UrlSync): () => void {
  applyTokens();
  let prev = store.get();
  applyTheme(resolveTheme(prev.settings.theme, prev.systemDark));
  const offStore = store.subscribe(() => {
    const s = store.get();
    if (s.settings !== prev.settings) saveSettings(s.settings);
    // The arrangement on screen keeps its adjustments in the layout; the rest wait in the book.
    if (s.adjust !== prev.adjust) for (const [k, a] of Object.entries(s.adjust)) saveAdjustments(k, a);
    const p = getProfile();
    if (p && s.review && (s.layout !== prev.layout || s.review !== prev.review)) saveAdjustments(adjustKey(p.id, s.review.arrangement), adjustmentsOf(s.layout, p, s.review.item));
    if (s.settings.theme !== prev.settings.theme || s.systemDark !== prev.systemDark) applyTheme(resolveTheme(s.settings.theme, s.systemDark));
    prev = s;
  });
  const offTheme = watchSystemTheme((systemDark) => store.set({ systemDark }));
  const offKeys = installKeyboard(store);
  const offPop = url.onPop(() => {
    arriveFromUrl(store, url);
    store.announce(msg.historyChanged);
  });
  // Dev-only handle so e2e can drive activity states (the sample panes rarely report them).
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __lab?: unknown }).__lab = { actions: store.actions };
  return () => { offStore(); offTheme(); offKeys(); offPop(); };
}
