/**
 * Explicit start-up. `boot` puts the first state in place before the first render (so the first paint is the shared
 * layout); `startUi` installs the page-lifetime listeners: keyboard, Back/Forward, theme, settings persistence.
 */
import * as core from "./layout";
import { installKeyboard, type KeyboardScope } from "./commands/keyboard";
import { presetById } from "./profile";
import { msg, toasts } from "./state/messages";
import { applyTheme, resolveTheme, saveSettings, watchSystemTheme } from "./state/settings";
import type { UiStore } from "./state/store";
import { applyTokens } from "./tokens";
import { savePrefs } from "./state/page-prefs";
import { savePaneState } from "./state/pane-state";
import { withoutOpened } from "./actions/page";
import type { UrlSync } from "./url";

/** Apply the URL to the store (first load, Back/Forward). A link that can't be read opens the current preset. */
function arriveFromUrl(store: UiStore, url: UrlSync): boolean {
  const r = url.read(store.env.kinds.registry());
  if (!r) return false;
  if ("page" in r) {
    const { tab, item, investigation } = r.page;
    store.actions.openPage({
      tab: tab || undefined,
      item: item || undefined,
      investigation,
      fromUrl: true,
      view: r.view,
    });
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

/** The store's URL sync, when it was made with one that can also read (createUrlSync). */
const syncOf = (store: UiStore, url?: UrlSync): UrlSync | undefined =>
  url ?? (store.url && "read" in store.url ? (store.url as UrlSync) : undefined);

/** Put the first state in place before the first render: the address's layout if it has one, fitted to the window. */
export function boot(store: UiStore, url?: UrlSync) {
  const sync = syncOf(store, url);
  if (sync) arriveFromUrl(store, sync);
  const panes = () => core.tree.panes(store.get().layout.root);
  store.actions.noteOpen(panes().map((p) => p.ref));
  const s = store.get();
  const layout = core.refit(s.layout, s.view, store.ctx());
  const first = panes()[0]?.id;
  store.set({
    layout,
    ...(!s.view.focused && first
      ? { view: { ...s.view, focused: first, focusHistory: [first] } }
      : {}),
  });
  store.writeUrl("replace");
}

/** What `startUi` takes over: keys (all of the page's, or only the workspace's), and the page's theme. */
export interface StartOptions {
  /** Keys: omitted, every key on the page; `{ root }`, only keys from inside the workspace and its dialogs. With a
   *  root, no tokens are written on `<html>` (the CSS carries them as fallbacks). */
  keys?: KeyboardScope;
  /** Set `data-theme` on `<html>` from the person's setting. Default true; false inside a page with its own theme
   *  (Jali then follows the system, or the host's `.dark` / `[data-theme]` scopes). */
  pageTheme?: boolean;
}

/**
 * Listeners for the life of the page: keyboard, Back/Forward, theme, saving settings and pane state, the leave-page
 * prompt. Returns a function that removes them (tests, HMR).
 */
export function startUi(
  store: UiStore,
  url?: UrlSync,
  { keys = {}, pageTheme = true }: StartOptions = {},
): () => void {
  const sync = syncOf(store, url);
  if (!keys.root && typeof document !== "undefined") applyTokens();
  let prev = store.get();
  // Pane state changes with typing and scrolling: saved once things settle.
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => savePaneState(store.storage, store.get().paneState), 400);
  };
  if (pageTheme) applyTheme(resolveTheme(prev.settings.theme, prev.systemDark));
  const offStore = store.subscribe(() => {
    const s = store.get();
    if (s.settings !== prev.settings) saveSettings(store.storage, s.settings);
    if (s.paneState !== prev.paneState) saveSoon();
    // A curated page's mode and split layout are the person's: saved on this device, opened panes left out.
    const p = store.env.profile;
    const live = s.page?.mode === "split" && s.layout !== prev.layout;
    if (p && (live || s.prefs !== prev.prefs)) {
      const layout = s.page?.mode === "split" ? s.layout : s.prefs.split;
      savePrefs(store.storage, p.id, {
        mode: s.prefs.mode,
        split: layout ? withoutOpened(layout, store.ctx()) : null,
      });
    }
    if (pageTheme && (s.settings.theme !== prev.settings.theme || s.systemDark !== prev.systemDark))
      applyTheme(resolveTheme(s.settings.theme, s.systemDark));
    prev = s;
  });
  // Leaving the page with unsaved work: the browser asks first.
  const onUnload = (e: BeforeUnloadEvent) => {
    if (Object.keys(store.get().unsaved).length) e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  const offTheme = watchSystemTheme((systemDark) => store.set({ systemDark }));
  const offKeys = installKeyboard(store, keys);
  const offPop = sync
    ? sync.onPop(() => {
        arriveFromUrl(store, sync);
        store.announce(msg.historyChanged);
      })
    : () => {};
  return () => {
    offStore();
    offTheme();
    offKeys();
    offPop();
    clearTimeout(saveTimer);
    window.removeEventListener("beforeunload", onUnload);
  };
}
