/**
 * The quickstart's app, running on the landing: the same `note` kind and starting layout as the code shown beside
 * it (src/samples/concepts/quickstart). One difference, for the page's sake: the address and storage are kept in
 * memory, so this page's own URL and localStorage stay as they are, and keys count only inside the workspace.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { boot, createPaneKinds, createUiStore, createUrlSync, installKeyboard, memoryLocation, memoryStorage, type UiStore } from "@jali/core";
import { Jali, JaliView } from "@jali/react";
import { note } from "../../samples/concepts/quickstart/note-open-beside";
import { start } from "../../samples/concepts/quickstart/start";

export interface NotesApp {
  store: UiStore;
  /** The address the workspace writes, in memory: the search string ("?l=…"), and how many history entries. */
  address(): { search: string; entries: number };
  subscribeAddress(fn: () => void): () => void;
}

export function useNotesApp(): NotesApp {
  const raw = useId();
  const [app] = useState<NotesApp>(() => {
    const location = memoryLocation();
    const storage = memoryStorage();
    const store = createUiStore({
      kinds: createPaneKinds([note]),
      presets: [{ id: "start", label: "Start", build: start }],
      url: createUrlSync({ location, storage }),
      storage,
      id: `landing-${raw.replace(/[^a-zA-Z0-9]/g, "")}`,
      name: "Notes",
    });
    boot(store);
    let last = { search: location.search(), entries: location.entries.length };
    const address = () => {
      const search = location.search(), entries = location.entries.length;
      if (search !== last.search || entries !== last.entries) last = { search, entries };
      return last;
    };
    // The URL writer replaces after resizes on a short timer, so listen to the store and read again a moment later.
    const subscribeAddress = (fn: () => void) => {
      let t: ReturnType<typeof setTimeout> | undefined;
      const off = store.subscribe(() => { fn(); clearTimeout(t); t = setTimeout(fn, 200); });
      return () => { off(); clearTimeout(t); };
    };
    return { store, address, subscribeAddress };
  });
  return app;
}

export function useAddress(app: NotesApp) {
  return useSyncExternalStore(app.subscribeAddress, app.address, app.address);
}

/** The workspace in a box. Keys count for it only when pressed inside it. */
export function NotesWorkspace({ app, height, label }: { app: NotesApp; height: number | string; label: string }) {
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
