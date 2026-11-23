/**
 * `urlSync()`: the layout lives in the address. A link reopens it, Back and Forward step through it, and a reload
 * keeps it. Without this feature the instance leaves the address alone (`createJali({ url })` still takes a writer of
 * the host's own).
 *
 *   createJali({ panes, layout, features: [urlSync()] });
 *   createJali({ panes, layout, features: [urlSync({ location, prefix: "n.", sizes: "link" })] });
 */
import { presetById } from "../env";
import type { ConfirmState, JaliStore } from "../state/store";
import { arrive, preset, readLayout } from "../actions/layout";
import {
  isChange,
  refuse,
  type ActionResult,
  type Change,
  type Outcome,
  type Snapshot,
} from "../state/apply";
import { through } from "../actions/step";
import { createUrlSync, type UrlSync, type UrlSyncOptions } from "../url";
import type { Feature } from "./feature";
import { urlSyncEn as words } from "../state/feature-messages";

const inBrowser = typeof window !== "undefined";

/** The store's URL sync, when it was made with one that can also read (createUrlSync). */
const syncOf = (store: JaliStore): UrlSync | undefined =>
  store.url && "read" in store.url ? (store.url as UrlSync) : undefined;

/** Apply the URL to the store (first load, Back/Forward). A link that can't be read opens the current preset.
 *  Undefined when the address holds no layout. `current`: whether this arrival is still the latest; one held for an
 *  answer (beforeClose, "Discard unsaved changes?") does nothing if a newer Back or Forward came meanwhile. */
function arriveFromUrl(
  store: JaliStore,
  url: UrlSync,
  current: () => boolean = () => true,
): ActionResult | undefined {
  const r = url.read(store.env.kinds.registry());
  if (!r) return undefined;
  // Superseded by a newer Back or Forward while it waited: kept as it is.
  const latest =
    (step: (x: Snapshot) => Outcome) =>
    (x: Snapshot): Outcome =>
      current() ? step(x) : refuse("kept");
  // The arrival is fitted to this window (its folds, its shown tabs): once it lands, the entry it came from says so,
  // so a reload or a copied link reopens what is on screen. A replace: Back and Forward step through the same
  // entries. Part of the arrival, so one held for an answer writes nothing until it lands, and nothing if it doesn't.
  const settling = (o: Outcome): Outcome => (isChange(o) ? { ...o, history: "replace" } : o);
  if ("page" in r) {
    const { tab, item, investigation, zoomOpened } = r.page;
    const page = store.env.page;
    // A link to another page than this instance's is not one it can open.
    if (!page || (r.page.page !== undefined && r.page.page !== store.env.profile?.id))
      return undefined;
    return store.apply(
      latest((x) =>
        through(x, page.open, {
          tab: tab || undefined,
          item: item || undefined,
          investigation,
          zoomOpened,
          fromUrl: true,
          view: r.view,
        }),
      ),
    );
  }
  // A link that names only a preset opens it, as choosing it does (the layout the app saved for it, if any). One this
  // instance doesn't have is not a link it can open.
  if ("openPreset" in r) {
    const id = r.openPreset;
    if (!store.env.presets.some((p) => p.id === id)) return undefined;
    return store.apply(latest((x) => settling(preset(x, id))));
  }
  // A preset the link names and this instance has; a link without one leaves the preset as it is.
  const named = r.preset && store.env.presets.some((p) => p.id === r.preset) ? r.preset : undefined;
  if ("broken" in r) {
    const p = presetById(store.env, named ?? store.get().presetId);
    const built = p && readLayout(p.build, store.env);
    url.keepBroken(r.broken);
    // Said, and the unreadable code gone from the address, once the preset it opens instead lands.
    const said: Change = {
      op: "patch",
      msg: store.messages.announcements.brokenLink,
      toast: store.messages.toasts.brokenLink(p?.label),
      history: "replace",
    };
    return store.apply(
      latest((x) => (built ? [settling(arrive(x, built, r.view, p.id)), said] : said)),
    );
  }
  return store.apply(latest((x) => settling(arrive(x, r.layout, r.view, named))));
}

/** Back and Forward, while the instance is started. */
function listen(store: JaliStore, sync: UrlSync): () => void {
  // Back and Forward. One that waits for an answer (the host's beforeClose, or "Discard unsaved changes?") keeps
  // its navigation with the question: if the layout doesn't change in the end, the address goes back to what is on
  // screen, so a reload or a copied link never opens what the person said no to. A newer Back or Forward takes the
  // place of an older one still waiting: its question closes, and its answer no longer changes anything.
  let nav = 0;
  let asking: ConfirmState | null = null;
  const offPop = sync.onPop(() => {
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
  });
  return () => {
    // An arrival still waiting for an answer is no longer the latest: its answer changes nothing.
    nav++;
    offPop();
  };
}

/**
 * The address feature. Options: `location` (a router's port; default the browser's history), `prefix` (two instances
 * on one address), `sizes` (`"local"`, the default, or `"link"`). Outside a browser, with no `location`, it does
 * nothing, so the same instance renders on a server.
 */
export function urlSync(options: Omit<UrlSyncOptions, "storage"> = {}): Feature {
  return {
    id: "urlSync",
    words,
    address: (storage) =>
      options.location || inBrowser ? createUrlSync({ storage, ...options }) : undefined,
    boot: (store) => {
      const sync = syncOf(store);
      if (sync) arriveFromUrl(store, sync);
    },
    start: (store) => {
      const sync = syncOf(store);
      return sync ? listen(store, sync) : () => {};
    },
  };
}
