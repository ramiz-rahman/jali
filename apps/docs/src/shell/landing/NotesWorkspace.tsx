/**
 * Small live workspaces the landing needs beyond the live parts in src/live:
 * - the quickstart's own app (the same `note` kind and starting layout as the code shown beside it), and
 * - a workspace on the demo kinds that writes its layout into an address, so the link can be shown.
 * Each keeps its address and storage in memory, so this page's own URL and localStorage stay as they are, and
 * takes keys only when they are pressed inside it.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { boot, createPaneKinds, createUiStore, createUrlSync, installKeyboard, memoryLocation, memoryStorage, type Layout, type UiStore } from "@jali/core";
import { Jali, JaliView } from "@jali/react";
import { note } from "../../samples/concepts/quickstart/note-open-beside";
import { start } from "../../samples/concepts/quickstart/start";
import { demoKinds } from "../../live/kinds";
import { buildDemoLayout, type DemoLayoutId } from "../../live/demo";

export interface LandingApp {
  store: UiStore;
  /** The address the workspace writes, in memory: the search string ("?l=…"), and how many history entries. */
  address(): { search: string; entries: number };
  subscribeAddress(fn: () => void): () => void;
}

type Source = { app: "quickstart" } | { app: "demo"; layout: DemoLayoutId };

function makeApp(source: Source, id: string): LandingApp {
  const location = memoryLocation();
  const storage = memoryStorage();
  const url = createUrlSync({ location, storage });
  const store = source.app === "quickstart"
    ? createUiStore({ kinds: createPaneKinds([note]), presets: [{ id: "start", label: "Start", build: start }], url, storage, id, name: "Notes" })
    : createUiStore({
        kinds: createPaneKinds(demoKinds),
        presets: [{ id: "start", label: "Start", build: (): Layout => buildDemoLayout(source.layout) }],
        url, storage, id, name: "Shop",
      });
  boot(store);
  let last = { search: location.search(), entries: location.entries.length };
  const address = () => {
    const search = location.search(), entries = location.entries.length;
    if (search !== last.search || entries !== last.entries) last = { search, entries };
    return last;
  };
  // Resizes are written on a short timer, so read again a moment after the store settles.
  const subscribeAddress = (fn: () => void) => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = store.subscribe(() => { fn(); clearTimeout(t); t = setTimeout(fn, 200); });
    return () => { off(); clearTimeout(t); };
  };
  return { store, address, subscribeAddress };
}

export function useLandingApp(source: Source): LandingApp {
  const raw = useId();
  const [app] = useState(() => makeApp(source, `landing-${raw.replace(/[^a-zA-Z0-9]/g, "")}`));
  return app;
}

export function useAddress(app: LandingApp) {
  return useSyncExternalStore(app.subscribeAddress, app.address, app.address);
}

/** The workspace in a box. Keys count for it only when pressed inside it. */
export function LandingWorkspace({ app, height, label }: { app: LandingApp; height: number | string; label: string }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => installKeyboard(app.store, { root: () => wrap.current }), [app.store]);
  return (
    <div className="live-figure landing-ws" role="group" aria-label={label} style={{ margin: 0, height: height === "100%" ? "100%" : undefined }}>
      <div className="live-ws landing-ws-box" ref={wrap} style={{ height }}>
        <Jali store={app.store} className="live-jali" settings={false}>
          <JaliView />
        </Jali>
      </div>
    </div>
  );
}
