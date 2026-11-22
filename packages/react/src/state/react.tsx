import { own } from "@jali/core/adapter";
/** React access to the store: one provider, and hooks that subscribe to exactly what a component reads. */
import type {
  AnyJali,
  JaliEvent,
  JaliEvents,
  NodeId,
  Messages,
  RefsOf,
  RegisteredJali,
  Theme,
} from "@jali/core";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Actions, Model, PaneAttributes, UiState, JaliStore } from "@jali/core/adapter";
import type { ReactEnv, Page } from "../define";
import { resolveTheme } from "@jali/core/adapter";
import { reactDom } from "../dom";
import { DEV } from "../dev";

const StoreContext = /* @__PURE__ */ createContext<JaliStore | null>(null);

/** Each store's DOM id as the host gave it, and the provider that scopes it while mounted. */
const bases = new WeakMap<JaliStore, string>();
const owners = new WeakMap<JaliStore, string>();
/** The DOM ids of the mounted workspaces, to catch two with the same one. */
const mounted = new Map<string, number>();

/**
 * The workspace's DOM scope. A workspace the host gave no `id` ("jali") scopes its ids with this mount's `useId()`, so
 * two on one page never share an id and their ARIA references never cross; the same on the server and in the
 * browser, and never stored. One the host gave an `id` keeps it; two mounted with the same one are a development
 * error. One provider per store scopes it (the first to render), so a second provider of the same store agrees.
 */
export function useDomScope(store: JaliStore) {
  const uid = useId();
  if (!bases.has(store)) bases.set(store, store.dom.id);
  if (!owners.has(store)) owners.set(store, uid);
  const base = bases.get(store)!;
  if (owners.get(store) === uid)
    store.dom.id = base === "jali" ? `jali-${uid.replace(/[^\w-]/g, "")}` : base;
  useEffect(() => {
    // Claimed again after an unmount (StrictMode runs effects twice): the store is this provider's while mounted.
    if (!owners.has(store)) owners.set(store, uid);
    if (owners.get(store) !== uid) return;
    const id = store.dom.id;
    const n = mounted.get(id) ?? 0;
    if (DEV && n)
      console.error(
        `Jali: two Jali roots on this page share the id "${id}", so their elements' ids repeat. Give each its own ` +
          "createJali({ id, label }).",
      );
    mounted.set(id, n + 1);
    return () => {
      owners.delete(store);
      const left = (mounted.get(id) ?? 1) - 1;
      if (left) mounted.set(id, left);
      else mounted.delete(id);
    };
  }, [store, uid]);
}

export function StoreProvider({ store, children }: { store: JaliStore; children?: ReactNode }) {
  // The core finds React's elements through this port (dom.ts). Giving it is idempotent, so it is safe in render, and
  // it is in place before any effect or event of the workspace runs. So is the DOM scope.
  store.dom.use(reactDom);
  useDomScope(store);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** A workspace as React code sees it: its kinds have components, its page a rail and header (define.ts). */
export type ReactJaliStore = JaliStore & { env: ReactEnv };

export function useStore(): ReactJaliStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore() outside <StoreProvider>");
  return store as ReactJaliStore;
}

export function useUi<T>(select: (s: UiState) => T): T {
  const store = useStore();
  const read = () => select(store.get());
  // The same read on the server: a workspace renders with server rendering (Next.js, Astro) as in the browser.
  return useSyncExternalStore(store.subscribe, read, read);
}

/** The derived workspace model; a new object only when something it depends on changed. */
export function useModel(): Model {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.model, store.model);
}

/** The model, re-rendering only when its geometry changes: a pane's live title makes a new model that shares the
 *  geometry (state/model.ts), and doesn't re-render this. For a part that reads no title as it renders; a title it
 *  shows is a `useModelValue` of its own. */
export function useGeometry(): Model {
  const store = useStore();
  const read = () => store.model().resolved;
  useSyncExternalStore(store.subscribe, read, read);
  return store.model();
}

/** One value read from the model (a title, whether a pane is tucked): re-renders only when it changes. Return a
 *  primitive, or an object the model keeps; a new object each time re-renders on every change. */
export function useModelValue<T>(select: (m: Model) => T): T {
  const store = useStore();
  const read = () => select(store.model());
  return useSyncExternalStore(store.subscribe, read, read);
}

/** The two states differ only in a drag's pointer (`dnd`), which nothing worked out from the rest reads. */
function onlyDrag(a: UiState, b: UiState): boolean {
  const ka = Object.keys(a) as (keyof UiState)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => k === "dnd" || a[k] === b[k]);
}

/**
 * A value worked out from the whole workspace (a pane's menu and buttons, the command list) that re-renders only when
 * it changes by `same`. It is worked out again when `deps` change or the state does, but not when only a drag's pointer
 * moved: a drag writes the state every frame.
 */
export function useDerived<T>(
  derive: () => T,
  same: (a: T, b: T) => boolean,
  deps: readonly unknown[],
): T {
  const store = useStore();
  const last = useRef<{ s: UiState; deps: readonly unknown[]; value: T } | null>(null);
  const read = () => {
    const s = store.get();
    const was = last.current;
    if (
      was &&
      was.deps.length === deps.length &&
      was.deps.every((d, i) => Object.is(d, deps[i])) &&
      (was.s === s || onlyDrag(was.s, s))
    )
      return was.value;
    const next = derive();
    const value = was && same(was.value, next) ? was.value : next;
    last.current = { s, deps, value };
    return value;
  };
  return useSyncExternalStore(store.subscribe, read, read);
}

export const useActions = (): Actions => useStore().actions;

/** This workspace's words (`createJali({ messages })`, English by default). */
export const useMessages = (): Messages => useStore().messages;

/** Emphasis inside a message (`messages.chooser.heading(title, bold)`). */
export const bold = (text: string) => <b>{text}</b>;

/** A message's parts, in the order the message gives them. */
export const Parts = ({ of }: { of: ReactNode[] }) => (
  <>
    {of.map((part, i) => (
      <Fragment key={i}>{part}</Fragment>
    ))}
  </>
);

/** This workspace's pane kinds and profile. */
export const useEnv = (): ReactEnv => useStore().env;
/** The curated page profile, when the workspace has one. */
export const useProfile = (): Page | null => useEnv().profile;
/**
 * The entries of `ids` in one of the state's per-pane records (`titles`, `unsaved`, `paneAttributes`, `activity`), as a
 * record of those panes only. Re-renders when one of their entries changes, and for no other pane's. The record keeps
 * its identity until then, so it can be an effect's dependency; read it with `own`.
 */
export function useEntriesOf<T>(
  record: (s: UiState) => Readonly<Record<NodeId, T>>,
  ids: readonly NodeId[],
): Readonly<Record<NodeId, T>> {
  const store = useStore();
  const last = useRef<Record<NodeId, T> | null>(null);
  const read = () => {
    const all = record(store.get());
    const was = last.current;
    const next: Record<NodeId, T> = {};
    let same = !!was;
    let n = 0;
    for (const id of ids) {
      if (!Object.hasOwn(all, id) || Object.hasOwn(next, id)) continue;
      const v = all[id]!;
      next[id] = v;
      n++;
      if (same && !(Object.hasOwn(was!, id) && Object.is(was![id], v))) same = false;
    }
    if (same && Object.keys(was!).length === n) return was!;
    return (last.current = next);
  };
  return useSyncExternalStore(store.subscribe, read, read);
}

/** The `data-*` attributes a pane set from its data (usePaneAttributes), to spread on what stands for it. */
export const usePaneAttributesOf = (id: NodeId | undefined): PaneAttributes | undefined =>
  useUi((s) => own(s.paneAttributes, id));

// ---------- the public names ----------

/**
 * The workspace: its actions (`useJali().actions.openBeside(pane, ref)`), events, layout, keymap and kinds. Typed as
 * the app's workspace once it is registered (`Register`), or as `J` when given.
 */
export const useJali = <J extends AnyJali = RegisteredJali>(): J => useStore().jali as unknown as J;
/**
 * A value picked from a snapshot (`get()`), kept while `isEqual` says the new pick is the same: a selector may return
 * a fresh object or array. Within one snapshot the pick is worked out once, so React reads the same value back; a new
 * selector (one that reads a changed prop) is worked out again. The shape of `useSyncExternalStoreWithSelector`.
 */
function useSelected<S, T>(
  subscribe: (fn: () => void) => () => void,
  get: () => S,
  select: (s: S) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  // The value last committed, which a new selector's pick is compared with.
  const committed = useRef<{ value: T } | null>(null);
  const read = useMemo(() => {
    let memo: { s: S; value: T } | null = null;
    return () => {
      const s = get();
      if (memo && Object.is(memo.s, s)) return memo.value;
      const next = select(s);
      const was = memo ?? committed.current;
      const value = was && isEqual?.(was.value, next) ? was.value : next;
      memo = { s, value };
      return value;
    };
  }, [get, select, isEqual]);
  const value = useSyncExternalStore(subscribe, read, read);
  useEffect(() => {
    committed.current = { value };
  }, [value]);
  return value;
}

/** One level of keys (or items) the same by `Object.is`: the equality for a selector that picks several values,
 *  `useJaliState((s) => ({ focused: s.view.focused, cap: s.settings.paneCap }), shallow)`. */
export function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.hasOwn(b, k) &&
      Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Part of the workspace's state, re-rendering only when it changes: `useJaliState((s) => s.view.focused)`. A selector
 * may return a new object or array; give `isEqual` (`shallow`) to re-render only when what it picked changed.
 */
export function useJaliState<T, J extends AnyJali = RegisteredJali>(
  select: (s: ReturnType<J["get"]>) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const store = useStore();
  return useSelected(store.subscribe, store.get, select as (s: UiState) => T, isEqual);
}

const whole = <T,>(m: T) => m;

/**
 * The workspace as it is on screen: its panes, their boxes and titles, the shelf. With a selector, only what it picks
 * (`useJaliModel((m) => m.title(id))`), re-rendering when that changes by `isEqual` (`Object.is` unless given).
 */
export function useJaliModel<J extends AnyJali = RegisteredJali>(): ReturnType<J["model"]>;
export function useJaliModel<T, J extends AnyJali = RegisteredJali>(
  select: (m: ReturnType<J["model"]>) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useJaliModel<T>(
  select: (m: Model) => T = whole as (m: Model) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const store = useStore();
  return useSelected(store.subscribe, store.model, select, isEqual);
}

/**
 * Hear one of the workspace's events while the component is mounted: `useJaliEvent("open", ({ ref }) => …)`,
 * `useJaliEvent("toast", show)`. It always calls the latest `handler`, so an inline function is fine, and stops
 * listening on unmount.
 */
export function useJaliEvent<E extends JaliEvent, J extends AnyJali = RegisteredJali>(
  event: E,
  handler: (event: JaliEvents<RefsOf<J>>[E]) => void,
): void {
  const store = useStore();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(
    () => store.on(event, (e) => latest.current(e as JaliEvents<RefsOf<J>>[E])),
    [store, event],
  );
}

/** The theme in use, "light" or "dark": the person's choice, or the system's when they chose "system". */
export const useJaliTheme = (): Theme => useUi((s) => resolveTheme(s.settings.theme, s.systemDark));
