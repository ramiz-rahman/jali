/**
 * Hydrating a server-rendered workspace without losing its panes' markup on React 18.
 *
 * Each pane's content sits in its own Suspense boundary (PaneBoundary.tsx). React hydrates those boundaries after the
 * rest of the page, at the lowest priority. React 18 can't take an update that reaches a boundary before then: it
 * throws the server's markup away and renders the boundary again in the browser ("This Suspense boundary received an
 * update before it finished hydrating"). React 19 hydrates the boundary first instead. An update from the store always
 * arrives synchronously (useSyncExternalStore), so `startTransition` can't help; it has to wait.
 *
 * The update that reaches a pane is the workspace measuring itself as it mounts: a size other than the server's can
 * pause or fold a pane, which its content hears. So a workspace that hydrates holds its measuring (Workspace.tsx)
 * until each pane boundary that mounted with it has hydrated, and then measures at once. The rest of the page is
 * interactive meanwhile. Nothing waits in a workspace rendered in the browser.
 */
import type { UiStore } from "@jali/core/adapter";

/** The pane boundaries of one workspace that mounted before their content did. */
export interface PaneHydration {
  /** A boundary mounted, and its content hasn't yet: it is still hydrating, or waiting for its data. */
  wait(boundary: object): void;
  /** That boundary's content mounted (or the boundary went away): it no longer holds anything back. */
  arrive(boundary: object): void;
  /** Runs `then` once no boundary waits: now, or when the last one arrives. Returns a cancel. */
  whenSettled(then: () => void): () => void;
}

const workspaces = new WeakMap<UiStore, PaneHydration>();

function createPaneHydration(): PaneHydration {
  const waiting = new Set<object>();
  const queued = new Set<() => void>();
  return {
    wait: (boundary) => void waiting.add(boundary),
    arrive(boundary) {
      if (!waiting.delete(boundary) || waiting.size) return;
      const run = [...queued];
      queued.clear();
      for (const then of run) then();
    },
    whenSettled(then) {
      if (!waiting.size) {
        then();
        return () => {};
      }
      queued.add(then);
      return () => void queued.delete(then);
    },
  };
}

/** The workspace's pane boundaries, as they hydrate. One per workspace, the same object every time. */
export function paneHydration(store: UiStore): PaneHydration {
  let gate = workspaces.get(store);
  if (!gate) workspaces.set(store, (gate = createPaneHydration()));
  return gate;
}
