/**
 * Pane lab: the registration interface for pane kinds, and the policy the workspace reads from each definition.
 *
 * A kind module exports `definePaneKind({...})`; `src/panes/index.ts` registers every kind before first render.
 *
 * Component rules:
 * - `ref` is the ObjectRef the pane shows (same as `node.ref`). React 19 passes `ref` to function components as a
 *   plain prop, so read it from props; do not use forwardRef.
 * - `paused` is true when the pane is hidden: tabbed away, tucked, folded, or covered by a zoomed pane.
 *   Pause live work while paused (TanStack Query: `subscribed: !paused` or `enabled: !paused`), keep state.
 * - Row keys inside list-like kinds: J/K or ↑/↓ move the selection and call `select(ref)`; Space calls `peek(ref)`
 *   (or `peek(null)` to close); ⌥↵ / ⌥-click call `openBeside(ref)`. The workspace keeps focus in the source pane
 *   after openBeside (founder decision 2) and makes an open peek, and a detail opened from the selection, follow
 *   `select` (actions/follow.ts). Report the selection before opening it, so the opened pane is linked to it.
 * - Data: read the shared DataLayer with `useDataLayer()` from `src/data/react`; never fetch outside the cache.
 * - Do not stop propagation of F6, ⌥/⌘ chords or Escape; the workspace keyboard layer listens on window.
 */
import type { ComponentType, ReactNode } from "react";
import type { KindRegistry, ObjectRef, PaneKind, PaneNode } from "../layout-core/types";

/** What a pane reports about itself; shown in its header, its tab, the shelf and the status line. */
export type PaneActivity = "idle" | "loading" | "working" | "needs-you" | "error";

export interface PaneComponentProps {
  /** The layout node. In the peek sheet this is a node that is not in the layout. */
  node: PaneNode;
  /** The object shown; equals node.ref. */
  ref: ObjectRef;
  /** Hidden (tab, tuck, fold, behind zoom): pause subscriptions and timers. */
  paused: boolean;
  /** This pane holds workspace focus (the accent edge). */
  focused: boolean;
  /** Open `ref` beside this pane. The selected item opens a following detail (pinned if one already follows); another
   *  link replaces this pane's earlier plain link of the same kind if there is one. */
  openBeside: (ref: ObjectRef) => void;
  /** Open (or move) the peek sheet to `ref`; `null` closes it. */
  peek: (ref: ObjectRef | null) => void;
  /**
   * Report the current selection; an open peek from this pane follows it, and so does this pane's following detail
   * once the selection rests. `{ inResults: false }`: the filter no longer shows `ref`; the detail keeps it, noted.
   */
  select: (ref: ObjectRef | null, opts?: { inResults?: boolean }) => void;
  /** Show `ref` in this same pane (same node, new ref). If it is already open elsewhere, that pane is focused instead. */
  openHere: (ref: ObjectRef) => void;
  /** Close this pane quietly (no undo toast): for transient panes such as the launcher. */
  dismiss: () => void;
  /** Report activity for the header, tab, shelf and status line. Optional to call. */
  setActivity: (activity: PaneActivity) => void;
  /** Workspace sources, given to transient kinds (the chooser a split opens). */
  recent?: ObjectRef[];
  isOpen?: (ref: ObjectRef) => boolean;
  KindIcon?: ComponentType<{ kind: string; size?: number }>;
  titleFor?: (ref: ObjectRef) => string;
  /** True when rendered inside the peek sheet rather than a pane. */
  inPeek: boolean;
}

export interface PaneKindDef {
  kind: string;
  title: (ref: ObjectRef) => string;
  ref: (params: ObjectRef["params"]) => ObjectRef;
  /** What makes two refs the same object. Default: every param, compared as text. `undefined` means scratch space:
   *  never deduplicated against open panes. */
  identity?: (ref: ObjectRef) => unknown;
  /** The type of object shown, shared by kinds that show the same objects differently (a loan review's record view
   *  shows a record). Two refs are the same object when their object types and identities match. Default: the kind. */
  object?: string;
  /** Stands in until the person chooses an object: closes quietly, and gets the workspace sources. */
  transient?: boolean;
  /** Listed in Recent. Default true. */
  recordable?: boolean | ((ref: ObjectRef) => boolean);
  /** Narrowest the content works at, once it adapts (container queries): the pane folds into a tab below it. */
  minWidth: number;
  minHeight: number;
  /** Where spare space takes the pane first. Default: minWidth. See PaneKind in layout-core/types for the share rule. */
  comfortableWidth?: number;
  /** Widest the content usefully uses (soft: spare space goes to siblings first; the content holds its measure past
   *  it). Omit for kinds that use any width, such as tables and charts. */
  maxWidth?: number;
  /** Heavy panes hold their content during a divider drag and reflow on release. */
  heavy?: boolean;
  /** Kind icon for the header, tab and shelf (a lucide-react icon or any 16px component). */
  icon?: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  Component: (props: PaneComponentProps) => ReactNode;
}

export function definePaneKind(def: PaneKindDef): PaneKindDef { return def; }

const kinds = new Map<string, PaneKindDef>();
const listeners = new Set<() => void>();
let version = 0;
let registry: { version: number; value: KindRegistry } | null = null;

export function registerPaneKind(def: PaneKindDef): void {
  kinds.set(def.kind, def);
  version++;
  for (const l of listeners) l();
}

export const getPaneKind = (kind: string): PaneKindDef | undefined => kinds.get(kind);
/** Bumped by every registration (HMR, late imports); caches of kind-derived values key on it. */
export const kindsVersion = () => version;
export function onKindsChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The framework-free view of the registry, for layout-core (resolve, validate, decode). Same object per version. */
export function kindRegistry(): KindRegistry {
  if (registry?.version === version) return registry.value;
  const value: KindRegistry = {};
  for (const d of kinds.values()) {
    const k: PaneKind = { kind: d.kind, title: d.title, minWidth: d.minWidth, minHeight: d.minHeight };
    if (d.maxWidth !== undefined) k.maxWidth = d.maxWidth;
    if (d.comfortableWidth !== undefined) k.comfortableWidth = d.comfortableWidth;
    value[d.kind] = k;
  }
  registry = { version, value };
  return value;
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

/** Params as order-free text, so ids compare as text (`1` equals `"1"`). */
const asText = (params: ObjectRef["params"]) => JSON.stringify(Object.keys(params).sort().map((k) => [k, String(params[k])]));

/** The ref's identity as text, or undefined for scratch kinds. */
export function identityOf(ref: ObjectRef): string | undefined {
  const def = kinds.get(ref.kind);
  if (!def?.identity) return asText(ref.params);
  const id = def.identity(ref);
  return id === undefined ? undefined : JSON.stringify(id);
}

const objectType = (ref: ObjectRef) => kinds.get(ref.kind)?.object ?? ref.kind;

/** Same object: same object type (kind, unless the kind says otherwise) and identity. Scratch refs are never the same
 *  object as anything. */
export function sameObject(a: ObjectRef, b: ObjectRef): boolean {
  if (objectType(a) !== objectType(b)) return false;
  const ia = identityOf(a);
  return ia !== undefined && ia === identityOf(b);
}

/** Same entry in Recent: the same object, or (scratch kinds) the same params. */
export const sameRecent = (a: ObjectRef, b: ObjectRef) => a.kind === b.kind && (identityOf(a) ?? asText(a.params)) === (identityOf(b) ?? asText(b.params));

export function isRecordable(ref: ObjectRef): boolean {
  const r = kinds.get(ref.kind)?.recordable;
  return typeof r === "function" ? r(ref) : r !== false;
}

export const isTransient = (ref: ObjectRef) => !!kinds.get(ref.kind)?.transient;
