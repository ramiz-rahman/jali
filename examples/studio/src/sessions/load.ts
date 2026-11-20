/**
 * The sessions' data, loaded when it is first wanted. Each session is a JSON file of 80 to 150 KB (its words, their
 * times and every track's envelope), so none is in the app's first download: Vite makes each one its own chunk.
 * Start-up loads the session the transport opens on before the first paint (main.tsx); the others load when a pane
 * or the transport asks for them. What the library and the pane titles show before then is in the catalogue.
 *
 * A pane reads a session with `useSession`, which suspends until it arrives: Jali shows the pane's loading state, and
 * a failure its failed state, whose Retry loads it again.
 */
import { useSyncExternalStore } from "react";
import { CATALOGUE } from "./catalog";
import type { SessionData } from "./types";

const FILES: Record<string, () => Promise<{ default: unknown }>> = {
  "apollo11-landing": () => import("./data/apollo11-landing.json"),
  "light-caught-by-the-stone": () => import("./data/light-caught-by-the-stone.json"),
  "dinner-party": () => import("./data/dinner-party.json"),
};

/** The library, in its order: the landing first (the session a first visit opens on), then the song, then dinner. */
export const SESSION_IDS: readonly string[] = Object.keys(FILES);

/** The session a first visit opens on, and every layout is designed with. */
export const FIRST_SESSION = "apollo11-landing";

/** Whether `id` names a session in the library (a link can name anything). */
export const isSession = (id: string) => Object.hasOwn(FILES, id) && Object.hasOwn(CATALOGUE, id);

const loaded = new Map<string, SessionData>();
const pending = new Map<string, Promise<SessionData>>();
const failed = new Map<string, unknown>();
const listeners = new Set<() => void>();
/** Every session once all have loaded, as one array (a stable snapshot for `useSessions`). */
let everySession: readonly SessionData[] | null = null;

/** A session's data, if it has loaded. */
export const sessionById = (id: string): SessionData | undefined => loaded.get(id);

/** Load a session (once; later calls share the first). Rejects for a name that isn't a session, or a failed load. */
export function loadSession(id: string): Promise<SessionData> {
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  let p = pending.get(id);
  if (p) return p;
  const file = isSession(id) ? FILES[id] : undefined;
  if (!file) return Promise.reject(new Error(`There is no session called “${id}”.`));
  p = file().then(
    (m) => {
      const s = m.default as SessionData;
      loaded.set(id, s);
      pending.delete(id);
      if (loaded.size === SESSION_IDS.length)
        everySession = SESSION_IDS.map((x) => loaded.get(x)).filter((x) => x !== undefined);
      for (const l of Array.from(listeners)) l();
      return s;
    },
    (error: unknown) => {
      pending.delete(id);
      failed.set(id, error);
      for (const l of Array.from(listeners)) l();
      throw error;
    },
  );
  pending.set(id, p);
  return p;
}

/** Every session, in the library's order. */
export const loadSessions = () => Promise.all(SESSION_IDS.map(loadSession));

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * A session's data in a component: `undefined` for a name that isn't a session; while it loads, the component
 * suspends. A failed load is thrown once, for the pane's failed state; its Retry renders again, which loads again.
 */
export function useSession(id: string): SessionData | undefined {
  const s = useSyncExternalStore(subscribe, () => loaded.get(id));
  if (s || !isSession(id)) return s;
  if (failed.has(id)) {
    const error = failed.get(id);
    failed.delete(id);
    throw error;
  }
  throw loadSession(id).catch(() => undefined);
}

/** Every session, in the library's order; suspends until all have loaded. */
export function useSessions(): readonly SessionData[] {
  const all = useSyncExternalStore(subscribe, () => everySession);
  if (all) return all;
  for (const id of SESSION_IDS) {
    if (!failed.has(id)) continue;
    const error = failed.get(id);
    failed.delete(id);
    throw error;
  }
  throw loadSessions().catch(() => undefined);
}
