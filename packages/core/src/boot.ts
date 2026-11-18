/**
 * Explicit start-up. `boot` puts the first state in place before the first render (so the first paint is the shared
 * layout); `startUi` installs the page-lifetime listeners: keyboard, Back/Forward, theme, settings persistence.
 */
import * as core from "./layout";
import { installKeyboard } from "./commands/keyboard";
import { presetById } from "./profile";
import { msg, toasts } from "./state/messages";
import { applyTheme, resolveTheme, saveSettings, watchSystemTheme } from "./state/settings";
import type { UiStore } from "./state/store";
import { applyTokens } from "./tokens";
import { savePrefs } from "./state/page-prefs";
import { savePaneState } from "./state/store";
import { withoutOpened } from "./actions/page";
import type { UrlSync } from "./url";

/** Apply the URL to the store (first load, Back/Forward). A link that can't be read opens the current preset. */
function arriveFromUrl(store: UiStore, url: UrlSync): boolean {
  const r = url.read(store.env.kinds.registry());
  if (!r) return false;
  if ("page" in r) {
    const { tab, item, investigation } = r.page;
    store.actions.openPage({ tab: tab || undefined, item: item || undefined, investigation, fromUrl: true, view: r.view });
  } else if ("broken" in r) {
    const p = presetById(store.env, store.get().presetId);
    if (p) store.actions.arrive(p.build(), r.view);
    url.keepBroken(r.broken);
    store.writeUrl("replace");
    store.toast(toasts.brokenLink(p?.label));
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
  // Pane state changes with typing and scrolling: saved once things settle.
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => savePaneState(store.storage, store.get().paneState), 400); };
  applyTheme(resolveTheme(prev.settings.theme, prev.systemDark));
  const offStore = store.subscribe(() => {
    const s = store.get();
    if (s.settings !== prev.settings) saveSettings(store.storage, s.settings);
    if (s.paneState !== prev.paneState) saveSoon();
    // A curated page's mode and multiplexed layout are the person's: saved on this device, opened panes left out.
    const p = store.env.profile;
    const live = s.page?.mode === "multi" && s.layout !== prev.layout;
    if (p && (live || s.prefs !== prev.prefs)) {
      const layout = s.page?.mode === "multi" ? s.layout : s.prefs.multi;
      savePrefs(store.storage, p.id, { mode: s.prefs.mode, multi: layout ? withoutOpened(layout, store.ctx()) : null });
    }
    if (s.settings.theme !== prev.settings.theme || s.systemDark !== prev.systemDark) applyTheme(resolveTheme(s.settings.theme, s.systemDark));
    prev = s;
  });
  // Leaving the page with unsaved work: the browser asks first.
  const onUnload = (e: BeforeUnloadEvent) => {
    if (Object.keys(store.get().unsaved).length) e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  const offTheme = watchSystemTheme((systemDark) => store.set({ systemDark }));
  const offKeys = installKeyboard(store);
  const offPop = url.onPop(() => {
    arriveFromUrl(store, url);
    store.announce(msg.historyChanged);
  });
  return () => { offStore(); offTheme(); offKeys(); offPop(); clearTimeout(saveTimer); window.removeEventListener("beforeunload", onUnload); };
}
