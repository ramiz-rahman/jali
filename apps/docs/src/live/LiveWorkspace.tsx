/**
 * One live workspace inside a docs figure. Each figure makes its own store (its own DOM id prefix, kept in memory,
 * never touching the page address or localStorage) and takes only the keys pressed inside it, so three workspaces
 * on one page never all answer ⌘K or F6.
 */
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { createPaneKinds, createUiStore, installKeyboard, layout as jl, memoryStorage, type UiStore } from "@jali/core";
import { Jali, JaliView, Shelf, useModel } from "@jali/react";
import { buildDemoLayout, type DemoLayoutId } from "./demo";
import { demoKinds } from "./kinds";
import "./live.css";

/** A store for one figure. Stable across renders; its id is safe in DOM ids and the same on server and client. */
export function useLiveStore(layoutId: DemoLayoutId): UiStore {
  const raw = useId();
  const [store] = useState(() =>
    createUiStore({
      kinds: createPaneKinds(demoKinds),
      initial: { layout: buildDemoLayout(layoutId), area: { width: 0, height: 0 } },
      storage: memoryStorage(),
      id: `live-${layoutId}-${raw.replace(/[^a-zA-Z0-9]/g, "")}`,
      name: "Shop",
    }),
  );
  return store;
}

/** Back to the layout the figure started with, fitted to its room. Focus is left where it is (on the reset button). */
export function resetLive(store: UiStore, layoutId: DemoLayoutId) {
  const view = { focusHistory: [] };
  store.set({
    layout: jl.refit(buildDemoLayout(layoutId), view, store.ctx()),
    view, selection: {}, undoStack: [], dnd: null, paneState: {}, resizeMode: null, paletteOpen: false, chooser: null,
  });
}

/** The status line under the panes: the shelf (folded and tucked panes) and a count. */
function LiveStatus() {
  const m = useModel();
  const tucked = m.shelf.length, folded = m.folded.length, n = m.visible.length;
  return (
    <footer className="live-statusbar" data-single={m.single || undefined}>
      <Shelf />
      <span className="live-statusbar-count">
        {n} on screen{folded ? ` · ${folded} folded` : ""}{tucked ? ` · ${tucked} tucked` : ""}
      </span>
    </footer>
  );
}

export interface LiveWorkspaceProps {
  store: UiStore;
  /** Height of the whole workspace (panes and status line), px. */
  height: number;
  /** Drawn over the workspace, inside its box (hover rings, the spotlight). */
  overlay?: ReactNode;
  wrapRef?: Ref<HTMLDivElement>;
  className?: string;
}

/**
 * The workspace in a box of a fixed height. The wrapper holds the Jali root and its dialogs, and is the keyboard's
 * scope: keys count for this workspace only when pressed inside it (or on the page body right after using it).
 */
export function LiveWorkspace({ store, height, overlay, wrapRef, className }: LiveWorkspaceProps) {
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => installKeyboard(store, { root: () => wrap.current }), [store]);
  const setRef = (el: HTMLDivElement | null) => {
    wrap.current = el;
    if (typeof wrapRef === "function") wrapRef(el);
    else if (wrapRef) (wrapRef as { current: HTMLDivElement | null }).current = el;
  };
  return (
    <div className={["live-ws", className].filter(Boolean).join(" ")} ref={setRef} style={{ height }}>
      <Jali store={store} className="live-jali" settings={false}>
        <JaliView />
        <LiveStatus />
      </Jali>
      {overlay}
    </div>
  );
}
