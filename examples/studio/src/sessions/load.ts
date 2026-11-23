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
import { isSession, SESSION_IDS, type SessionId } from "./ids";
import type { SessionData } from "./types";

const FILES: Record<SessionId, () => Promise<{ default: unknown }>> = {
  "apollo11-landing": () => import("./data/apollo11-landing.json"),
  "light-caught-by-the-stone": () => import("./data/light-caught-by-the-stone.json"),
  "dinner-party": () => import("./data/dinner-party.json"),
};

const loaded = new Map<SessionId, SessionData>();
const pending = new Map<SessionId, Promise<SessionData>>();
const failed = new Map<SessionId, unknown>();
const listeners = new Set<() => void>();
// A copy: a listener may unsubscribe while being called.
const notify = () => {
  for (const l of Array.from(listeners)) l();
};
/** Every session once all have loaded, as one array (a stable snapshot for `useSessions`). */
let everySession: readonly SessionData[] | null = null;

/** A session's data, if it has loaded. */
export const sessionById = (id: string): SessionData | undefined =>
  isSession(id) ? loaded.get(id) : undefined;

/** Load a session (once; later calls share the first). Rejects for a name that isn't a session, or a failed load. */
export function loadSession(id: string): Promise<SessionData> {
  if (!isSession(id)) return Promise.reject(new Error(`There is no session called “${id}”.`));
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  const waiting = pending.get(id);
  if (waiting) return waiting;
  const p = FILES[id]().then(
    (m) => {
      const s = m.default as SessionData;
      loaded.set(id, s);
      pending.delete(id);
      if (loaded.size === SESSION_IDS.length) everySession = SESSION_IDS.map((x) => loaded.get(x)!);
      notify();
      return s;
    },
    (error: unknown) => {
      pending.delete(id);
      failed.set(id, error);
      notify();
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
  const s = useSyncExternalStore(subscribe, () => sessionById(id));
  if (s || !isSession(id)) return s;
  throwFailure(id);
  throw loadSession(id).catch(() => undefined);
}

/** Every session, in the library's order; suspends until all have loaded. */
export function useSessions(): readonly SessionData[] {
  const all = useSyncExternalStore(subscribe, () => everySession);
  if (all) return all;
  SESSION_IDS.forEach(throwFailure);
  throw loadSessions().catch(() => undefined);
}

/** A failed load of `id`, thrown once for the pane's failed state, whose Retry renders again and so loads again. */
function throwFailure(id: SessionId) {
  if (!failed.has(id)) return;
  const error = failed.get(id);
  failed.delete(id);
  throw error;
}
