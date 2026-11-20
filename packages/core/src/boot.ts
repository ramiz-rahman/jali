/**
 * Explicit start-up. `boot` puts the first state in place before the first render (so the first paint is the shared
 * layout); `startUi` installs the page-lifetime listeners: keyboard, Back/Forward, theme, settings persistence.
 */
import * as core from "./layout";
import { installKeyboard, type KeyboardScope } from "./commands/keyboard";
import { presetById } from "./profile";

import { applyTheme, resolveTheme, saveSettings, watchSystemTheme } from "./state/settings";
import type { ConfirmState, UiStore } from "./state/store";
import { applyTokens } from "./tokens";
import { savePrefs } from "./state/page-prefs";
import { ownedPaneState, ownedSelection, savePaneState } from "./state/pane-state";
import { openPage, withoutOpened } from "./actions/page";
import { arrive } from "./actions/layout";
import { agreeOnArrival } from "./actions/follow";
import { DONE, refuse, type ActionResult, type Outcome, type Snapshot } from "./state/apply";
import type { UrlSync } from "./url";

/** Apply the URL to the store (first load, Back/Forward). A link that can't be read opens the current preset.
 *  Undefined when the address holds no layout. `current`: whether this arrival is still the latest; one held for an
 *  answer (beforeClose, "Discard unsaved changes?") does nothing if a newer Back or Forward came meanwhile. */
function arriveFromUrl(
  store: UiStore,
  url: UrlSync,
  current: () => boolean = () => true,
): ActionResult | undefined {
  const r = url.read(store.env.kinds.registry());
  if (!r) return undefined;
  const latest =
    (step: (x: Snapshot) => Outcome) =>
    (x: Snapshot): Outcome =>
      current() ? step(x) : null;
  if ("page" in r) {
    const { tab, item, investigation } = r.page;
    return store.apply(
      latest((x) =>
        openPage(x, {
          tab: tab || undefined,
          item: item || undefined,
          investigation,
          fromUrl: true,
          view: r.view,
        }),
      ),
    );
  }
  // A preset the link names and this workspace has; a link without one leaves the preset as it is.
  const named = r.preset && store.env.presets.some((p) => p.id === r.preset) ? r.preset : undefined;
  if ("broken" in r) {
    const p = presetById(store.env, named ?? store.get().presetId);
    const done = p ? store.apply(latest((x) => arrive(x, p.build(), r.view, p.id))) : DONE;
    url.keepBroken(r.broken);
    store.writeUrl("replace");
    store.toast(store.messages.toasts.brokenLink(p?.label));
    store.announce(store.messages.announcements.brokenLink);
    return done;
  }
  return store.apply(latest((x) => arrive(x, r.layout, r.view, named)));
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
  if (!keys.root && typeof document !== "undefined") applyTokens(undefined, store.env.spacing);
  let prev = store.get();
  // Pane state changes with typing and scrolling: saved once things settle.
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const saveSoon = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const s = store.get();
      savePaneState(store.storage, s.paneState, s.paneStateOf);
    }, 400);
  };
  if (pageTheme) applyTheme(resolveTheme(prev.settings.theme, prev.systemDark));
  const offStore = store.subscribe(() => {
    const s = store.get();
    if (s.settings !== prev.settings) saveSettings(store.storage, s.settings);
    if (s.paneState !== prev.paneState || s.paneStateOf !== prev.paneStateOf) saveSoon();
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
    if (store.env.confirmDiscard !== false && Object.keys(store.get().unsaved).length)
      e.preventDefault();
  };
  window.addEventListener("beforeunload", onUnload);
  const offTheme = watchSystemTheme((systemDark) => store.set({ systemDark }));
  const offKeys = installKeyboard(store, keys);
  // Back and Forward. One that waits for an answer (the host's beforeClose, or "Discard unsaved changes?") keeps
  // its navigation with the question: if the layout doesn't change in the end, the address goes back to what is on
  // screen, so a reload or a copied link never opens what the person said no to. A newer Back or Forward takes the
  // place of an older one still waiting: its question closes, and its answer no longer changes anything.
  let nav = 0;
  let asking: ConfirmState | null = null;
  const offPop = sync
    ? sync.onPop(() => {
        const mine = ++nav;
        const held = store.get().confirm;
        if (held && held === asking)
          store.apply([
            { op: "patch", patch: { confirm: null } },
            { op: "answer", intent: () => refuse("kept"), agreed: {}, settle: held.settle },
          ]);
        const settle = (end: ActionResult | undefined) => {
          if (mine !== nav || !end || end.ok) return;
          if (end.reason === "pending") return void end.settled?.then(settle);
          if (end.reason === "unsaved") {
            asking = store.get().confirm;
            return void asking?.settled.then(settle);
          }
          store.writeUrl("replace");
        };
        settle(arriveFromUrl(store, sync, () => mine === nav));
        store.announce(store.messages.announcements.historyChanged);
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
