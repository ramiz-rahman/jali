/**
 * Pane lab: the React registration interface for pane kinds (WP3 owns it, WP4 plugs into it).
 *
 * A pane kind module calls `registerPaneKind({...})` once at import time. `src/panes/index.ts` should import
 * every kind module; the app loads that file before first render.
 *
 *   registerPaneKind({
 *     kind: "record",
 *     title: (ref) => `${ref.params.table} #${ref.params.id}`,
 *     minWidth: 480, minHeight: 240,
 *     icon: FileText,
 *     Component: RecordPane,
 *   });
 *
 * Component rules:
 * - `ref` is the ObjectRef the pane shows (same as `node.ref`). React 19 passes `ref` to function components as a
 *   plain prop, so read it from props; do not use forwardRef.
 * - `paused` is true when the pane is hidden: tabbed away, collapsed to a rail/header, or covered by a zoomed pane.
 *   Pause live work while paused (TanStack Query: `subscribed: !paused` or `enabled: !paused`), keep state.
 * - Row keys inside list-like kinds: J/K or ↑/↓ move the selection and call `select(ref)`; Space calls `peek(ref)`
 *   (or `peek(null)` to close); ⌥↵ / ⌥-click call `openBeside(ref)`. The workspace keeps focus in the source pane
 *   after openBeside (founder decision 2) and makes an open peek follow `select`.
 * - Data: `useDataLayer()` gives the shared DataLayer (api, keys, queryClient). Use TanStack Query hooks with
 *   `keys.*`; never fetch outside the cache.
 * - Do not stop propagation of F6, ⌥/⌘ chords or Escape; the workspace keyboard layer listens on window.
 */
import { createContext, createElement, useContext, useSyncExternalStore } from "react";
import type { ComponentType, ReactNode } from "react";
import type { KindRegistry, ObjectRef, PaneKind, PaneNode } from "../layout-core/types";
import type { DataLayer } from "../data/types";

/** What a pane reports about itself; shown in its header, its tab and its rail. */
export type PaneActivity = "idle" | "loading" | "working" | "needs-you" | "error";

export interface PaneComponentProps {
  /** The layout node. In a peek sheet this is a synthetic node (id "peek"). */
  node: PaneNode;
  /** The object shown; equals node.ref. */
  ref: ObjectRef;
  /** Hidden (tab, rail, header-only, behind zoom): pause subscriptions and timers. */
  paused: boolean;
  /** This pane holds workspace focus (the 1.5px accent edge). */
  focused: boolean;
  /** Open `ref` beside this pane; replaces this pane's linked pane of the same kind if there is one. */
  openBeside: (ref: ObjectRef) => void;
  /** Open (or move) the peek sheet to `ref`; `null` closes it. */
  peek: (ref: ObjectRef | null) => void;
  /** Report the current selection; an open peek from this pane follows it. */
  select: (ref: ObjectRef | null) => void;
  /** Show `ref` in this same pane (same node, new ref). If it is already open elsewhere, that pane is focused instead. */
  openHere: (ref: ObjectRef) => void;
  /** Close this pane quietly (no undo toast): for transient panes such as the launcher. */
  dismiss: () => void;
  /** Report activity for the header, tab, rail and status line. Optional to call. */
  setActivity: (activity: PaneActivity) => void;
  /** True when rendered inside the peek sheet rather than a pane. */
  inPeek: boolean;
  /** True while a divider drag is in progress and this kind is heavy: content is held at its old size. */
  holding: boolean;
}

export interface PaneKindDef {
  kind: string;
  title: (ref: ObjectRef) => string;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  preferredWidth?: number;
  /** Heavy panes hold their content during a divider drag and reflow on release. */
  heavy?: boolean;
  /** Kind icon for the header, tab and rail (a lucide-react icon or any 16px component). */
  icon?: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  Component: (props: PaneComponentProps) => ReactNode;
}

const kinds = new Map<string, PaneKindDef>();
const listeners = new Set<() => void>();
let version = 0;

export function registerPaneKind(def: PaneKindDef): void {
  kinds.set(def.kind, def);
  version++;
  for (const l of listeners) l();
}

export function getPaneKind(kind: string): PaneKindDef | undefined {
  return kinds.get(kind);
}

export function allPaneKinds(): PaneKindDef[] {
  return [...kinds.values()];
}

/** The framework-free view of the registry, for layout-core (resolve, validate, decode). */
export function kindRegistry(): KindRegistry {
  const out: KindRegistry = {};
  for (const d of kinds.values()) {
    const k: PaneKind = { kind: d.kind, title: d.title, minWidth: d.minWidth, minHeight: d.minHeight };
    if (d.maxWidth !== undefined) k.maxWidth = d.maxWidth;
    if (d.preferredWidth !== undefined) k.preferredWidth = d.preferredWidth;
    if (d.heavy) k.heavy = true;
    out[d.kind] = k;
  }
  return out;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-renders when a kind registers (HMR, late imports). Returns a version number. */
export function usePaneKindsVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Title for a ref, falling back to the kind name when the kind is unknown. */
export function paneTitle(ref: ObjectRef): string {
  const def = kinds.get(ref.kind);
  try {
    return def ? def.title(ref) : ref.kind;
  } catch {
    return ref.kind;
  }
}

// ---- Shared data for pane kinds ----

const DataLayerContext = createContext<DataLayer | null>(null);

export function DataLayerProvider({ value, children }: { value: DataLayer; children?: ReactNode }) {
  return createElement(DataLayerContext.Provider, { value }, children);
}

/** The shared DataLayer (api, keys, queryClient, invalidateEntities, stats). */
export function useDataLayer(): DataLayer {
  const d = useContext(DataLayerContext);
  if (!d) throw new Error("useDataLayer() outside <DataLayerProvider>");
  return d;
}
