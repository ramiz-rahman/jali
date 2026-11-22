/**
 * One live workspace inside a docs figure. Each figure makes its own store (its own DOM id prefix, kept in memory,
 * never touching the page address or localStorage) and takes only the keys pressed inside it, so three workspaces
 * on one page never all answer ⌘K or F6.
 */
import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import {
  createPaneKinds,
  createJaliStore,
  layout as jl,
  memoryStorage,
  type JaliStore,
} from "jali/adapter";
import { JaliRoot, JaliView, Shelf, useJaliModel } from "jali/react";
import { chooser } from "jali/chooser";
import { palette } from "jali/palette";
import { buildDemoLayout, type DemoLayoutId } from "./demo";
import { demoKinds } from "./kinds";
import { ClientOnly } from "./ClientOnly";

/**
 * A store for one figure. Stable across renders; its id is safe in DOM ids and the same on server and client.
 * `label` names the workspace's landmarks (the figure's caption), so figures on one page never repeat one.
 * `centreDrop` is what a drop on a pane's middle does here (Jali's default swaps; the hero adds it as a tab).
 */
export function useLiveStore(
  layoutId: DemoLayoutId,
  label: string,
  centreDrop?: "swap" | "tab",
): JaliStore {
  const raw = useId();
  const [store] = useState(() =>
    createJaliStore({
      kinds: createPaneKinds(demoKinds),
      initial: { layout: buildDemoLayout(layoutId), area: { width: 0, height: 0 } },
      storage: memoryStorage(),
      id: `live-${layoutId}-${raw.replace(/[^a-zA-Z0-9]/g, "")}`,
      name: "Shop",
      label,
      // A figure on a docs page: only its own keys, and the site keeps its theme.
      keyboard: { scope: "local" },
      pageTheme: false,
      // ⌘K and the chooser; Settings stays the site's own.
      features: [palette(), chooser()],
      ...(centreDrop ? { settings: { centreDrop } } : {}),
    }),
  );
  return store;
}

/** Back to the layout the figure started with, fitted to its room. Focus is left where it is (on the reset button). */
export function resetLive(store: JaliStore, layoutId: DemoLayoutId) {
  const view = { focusHistory: [] };
  store.set({
    layout: jl.refit(buildDemoLayout(layoutId), view, store.ctx()),
    view,
    selection: {},
    undoStack: [],
    dnd: null,
    paneState: {},
    resizeMode: null,
    paletteOpen: false,
    chooser: null,
  });
}

/** The status line under the panes: the shelf (tucked panes) and a count. */
function LiveStatus() {
  const m = useJaliModel();
  const tucked = m.shelf.length,
    folded = m.folded.length,
    n = m.visible.length;
  return (
    <footer className="live-statusbar" data-one-pane={m.onePane || undefined}>
      <Shelf />
      <span className="live-statusbar-count">
        {n} on screen{folded ? ` · ${folded} folded` : ""}
        {tucked ? ` · ${tucked} tucked` : ""}
      </span>
    </footer>
  );
}

export interface LiveWorkspaceProps {
  store: JaliStore;
  /** Height of the whole workspace (panes and status line): px, or a CSS length. */
  height: number | string;
  /** Drawn over the workspace, inside its box (hover rings, the spotlight). */
  overlay?: ReactNode;
  wrapRef?: Ref<HTMLDivElement>;
  className?: string;
  /** The status line under the panes (the shelf and a count). Default true. */
  status?: boolean;
}

/**
 * The workspace in a box of a fixed height. The wrapper holds the Jali root and its dialogs, and is the keyboard's
 * scope: keys count for this workspace only when pressed inside it (or on the page body right after using it).
 */
export function LiveWorkspace({
  store,
  height,
  overlay,
  wrapRef,
  className,
  status = true,
}: LiveWorkspaceProps) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    wrap.current = el;
    if (typeof wrapRef === "function") wrapRef(el);
    else if (wrapRef) (wrapRef as { current: HTMLDivElement | null }).current = el;
  };
  return (
    <div
      className={["live-ws", className].filter(Boolean).join(" ")}
      ref={setRef}
      style={{ height }}
    >
      <ClientOnly>
        <JaliRoot jali={store.jali} className="live-jali">
          <JaliView />
          {status ? <LiveStatus /> : null}
        </JaliRoot>
      </ClientOnly>
      {overlay}
    </div>
  );
}
