/**
 * The two places an instance keeps things outside itself, as ports the host can replace.
 *
 * - **Location**: the address. Jali reads and writes only its own search params and keeps every other part of the
 *   address as it is. The default is the browser's history; an app with a router passes an adapter, so the router
 *   stays the one owner of the address (navigation guards, scroll restoration, typed search params).
 * - **Storage**: what one person keeps on one device (settings, a curated page's mode and layout). The default is
 *   localStorage under a prefix; tests, server rendering and embedded instances pass `memoryStorage()`.
 *
 * A router adapter is three functions. React Router:
 *
 *   const navigate = useNavigate(), at = useLocation();
 *   const location: LocationPort = {
 *     search: () => window.location.search,
 *     href: () => window.location.href,
 *     navigate: (search, mode) => navigate({ search }, { replace: mode === "replace" }),
 *     subscribe: (fn) => { const id = setTimeout(fn); return () => clearTimeout(id); }, // or a listener on `at`
 *   };
 *
 * TanStack Router: `router.navigate({ search: Object.fromEntries(new URLSearchParams(search)), replace })` and
 * `router.subscribe("onResolved", fn)`.
 */

export type NavigateMode = "push" | "replace";

export interface LocationPort {
  /** The current search string ("?a=1" or ""). */
  search(): string;
  /** The whole address, for "Copy link". */
  href(): string;
  /** Go to the same address with `search` as its search string: a new history entry (push) or in place (replace). */
  navigate(search: string, mode: NavigateMode): void;
  /** Called when the address changes by any means other than `navigate` (Back, Forward, a router link). */
  subscribe(fn: () => void): () => void;
}

export function browserLocation(win: Window = window): LocationPort {
  return {
    search: () => win.location.search,
    href: () => win.location.href,
    navigate(search, mode) {
      // From the whole address, not the path: a path that starts with `//` (`//evil.com/x`) would read as another
      // host, and the history would refuse to go there.
      const url = new URL(win.location.href);
      url.search = search;
      if (url.href === win.location.href) return;
      // A replace keeps the entry's state (a router's, the host's): Jali owns its search params, not the entry.
      if (mode === "push") win.history.pushState(null, "", url.href);
      else win.history.replaceState(win.history.state, "", url.href);
    },
    subscribe(fn) {
      win.addEventListener("popstate", fn);
      return () => win.removeEventListener("popstate", fn);
    },
  };
}

/** An address that lives in memory: tests, server rendering, an instance in a dialog that must not touch the page's. */
export function memoryLocation(
  initial = "",
): LocationPort & { entries: string[]; visit(search: string): void } {
  const entries = [initial];
  const fns = new Set<() => void>();
  return {
    entries,
    search: () => entries[entries.length - 1]!,
    href: () => `memory:${entries[entries.length - 1]!}`,
    navigate(search, mode) {
      if (mode === "push") entries.push(search);
      else entries[entries.length - 1] = search;
    },
    subscribe(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    /** Navigation the instance did not make (a router link, Back): the address changes and subscribers hear it. */
    visit(search) {
      entries.push(search);
      for (const fn of fns) fn();
    },
  };
}

export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
  /** Take `key` out of storage. Optional: without it, Jali writes an empty value over a key it no longer uses. */
  remove?(key: string): void;
  /** Hear `key` change by another means than this port's `set` (another tab, with localStorage). Optional: without
   *  it, an instance learns what other tabs saved when it next starts. Returns the unsubscribe. */
  subscribe?(key: string, fn: () => void): () => void;
}

/** localStorage under `prefix`. Reads and writes never throw: private mode or blocked storage just saves nothing.
 *  Other tabs' writes are heard through the `storage` event. */
export function browserStorage(prefix: string): StoragePort {
  return {
    get(key) {
      try {
        return localStorage.getItem(`${prefix}:${key}`);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`${prefix}:${key}`, value);
      } catch {
        /* nothing saved */
      }
    },
    subscribe(key, fn) {
      // `key` null: another tab cleared storage.
      const on = (e: StorageEvent) => (e.key === null || e.key === `${prefix}:${key}`) && fn();
      addEventListener("storage", on);
      return () => removeEventListener("storage", on);
    },
  };
}

export function memoryStorage(initial: Record<string, string> = {}): StoragePort {
  const m = new Map(Object.entries(initial));
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}
