/**
 * Explicit start-up. `boot` puts the first state in place before the first render (so the first paint is the shared
 * layout); `startUi` installs the page-lifetime listeners: keyboard, Back/Forward, theme, settings persistence.
 */
import * as core from "./layout/engine";
import { installKeyboard, type KeyboardScope } from "./commands/keyboard";

import { applyTheme, resolveTheme, saveSettings, watchSystemTheme } from "./state/settings";
import type { JaliStore } from "./state/store";
import { applyTokens } from "./tokens";
import { savePrefs } from "./state/page-prefs";
import { ownedPaneState, ownedSelection, PANE_STATE_KEY } from "./state/pane-state";
import { agreeOnArrival } from "./actions/follow";

/** Put the first state in place before the first render: the address's layout if it has one, fitted to the window. */
export function boot(store: JaliStore) {
  // A feature's work before the first render: urlSync opens the address's layout.
  for (const f of store.env.features ?? []) f.boot?.(store);
  const panes = () => core.tree.panes(store.get().layout.root);
  store.actions.noteOpen(panes().map((p) => p.ref));
  const s = store.get();
  const layout = core.refit(s.layout, s.view, store.ctx());
  const first = panes()[0]?.id;
  // The lists' selections agree with what their followers show (a link has done it already).
  const selection = agreeOnArrival(store.env, layout, s.selection, s.selectionOf);
  // Saved pane state is only for panes that show the object it was saved for; selections belong to their lists.
  const owned = ownedPaneState(s, store.env.kinds, [layout]);
  const selected = ownedSelection(s, selection, store.env.kinds, layout);
  store.set({
    layout,
    ...owned,
    ...selected,
    ...(!s.view.focused && first
      ? { view: { ...s.view, focused: first, focusHistory: [first] } }
      : {}),
  });
  // What came from storage and the arriving layout shows is in step with storage; the rest stays there, untouched
  // (another tab's panes), and is never written over by this one.
  store.paneStates.adopt(store.get());
  store.writeUrl("replace");
}

/** Save pane state (and the objects it belongs to) now: what changed since the last save, over what other tabs saved
 *  meanwhile. Nothing is written when nothing changed. */
export function flushPaneState(store: JaliStore) {
  store.paneStates.flush(store.get());
}

/** What `startUi` takes over: keys (all of the page's, or only the instance's), and the page's theme. */
export interface StartOptions {
  /** Keys: omitted, every key on the page; `{ root }`, only keys from inside the instance and its dialogs. With a
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
  store: JaliStore,
  { keys = {}, pageTheme = true }: StartOptions = {},
): () => void {
  if (!keys.root && typeof document !== "undefined") applyTokens(undefined, store.env.spacing);
  let prev = store.get();
  // Pane state changes with typing and scrolling: saved once things settle.
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      flushPaneState(store);
    }, 400);
  };
  if (pageTheme) applyTheme(resolveTheme(prev.settings.theme, prev.systemDark));
  const offStore = store.subscribe(() => {
    const s = store.get();
    if (s.settings !== prev.settings) saveSettings(store.storage, s.settings);
    if (s.paneState !== prev.paneState || s.paneStateOf !== prev.paneStateOf) saveSoon();
    // A curated page's mode and split layout are the person's: saved on this device, opened panes left out.
    const p = store.env.profile,
      page = store.env.page;
    const live = s.page?.mode === "split" && s.layout !== prev.layout;
    if (p && page && (live || s.prefs !== prev.prefs)) {
      const layout = s.page?.mode === "split" ? s.layout : s.prefs.split;
      savePrefs(store.storage, p.id, {
        mode: s.prefs.mode,
        split: layout ? page.withoutOpened(layout, store.ctx()) : null,
      });
    }
    if (pageTheme && (s.settings.theme !== prev.settings.theme || s.systemDark !== prev.systemDark))
      applyTheme(resolveTheme(s.settings.theme, s.systemDark));
    prev = s;
  });
  // Leaving the page with unsaved work: the browser asks first.
  const onUnload = (e: BeforeUnloadEvent) => {
    if (store.env.confirmDiscard !== false && Object.keys(store.get().unsaved).length)
      e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  // A save still waiting when the page goes away (a reload, a closed tab, a phone switching apps) is made now, so a
  // draft typed just before is kept. `pagehide` is the page leaving; a hidden page may never come back to run a timer.
  const saveNow = () => {
    if (saveTimer === undefined) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    flushPaneState(store);
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") saveNow();
  };
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", onHidden);
  const offTheme = watchSystemTheme((systemDark) => store.set({ systemDark }));
  // Pane state another tab saved, for an object this one shows under that pane id, comes in (a draft typed there
  // shows here); a record another tab took out that this one still holds is saved again.
  const offShared =
    store.storage.subscribe?.(PANE_STATE_KEY, () => {
      const s = store.get();
      const { patch, resave } = store.paneStates.merge(s, store.env.kinds, [
        s.layout,
        ...s.undoStack.map((e) => e.before.layout),
      ]);
      if (patch) store.set(patch);
      if (resave) saveSoon();
    }) ?? (() => {});
  const offKeys = installKeyboard(store, keys);
  // Each feature's listeners for the page's lifetime (urlSync: Back and Forward).
  const offFeatures = (store.env.features ?? []).map((f) => f.start?.(store) ?? (() => {}));
  return () => {
    for (const off of offFeatures) off();
    offStore();
    offTheme();
    offShared();
    offKeys();
    // Pane state still waiting to be saved is saved now, not dropped.
    saveNow();
    window.removeEventListener("pagehide", saveNow);
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("beforeunload", onUnload);
  };
}
