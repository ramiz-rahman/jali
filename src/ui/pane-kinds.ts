/**
 * Pane kinds: the framework-free part of a kind (title, identity, sizes) and the registry a workspace keeps of them.
 * A framework adapter adds the view: @jali/react's `definePaneKind` (ui/define.ts) adds `Component` and `icon`.
 */
import type { KindRegistry, ObjectRef, PaneKind, PaneNode } from "../layout-core/types";

/**
 * A command a pane adds to ⌘K while it is focused ("Run query", "Save"). `keys` is the label only: the content
 * handles its own keys (content first). `disabled` greys it out, with the reason read to screen readers.
 */
export interface PaneCommand {
  id: string;
  title: string;
  run: () => void;
  keys?: string;
  disabled?: string | false;
}

/** What a pane reports about itself; shown in its header, its tab, the shelf and the status line. */
export type PaneActivity = "idle" | "loading" | "working" | "needs-you" | "error";

/**
 * What the workspace knows about a kind, without its view: a title, identity, and sizes. Framework adapters extend it
 * with the view (@jali/react: `Component` and `icon`).
 */
export interface PaneKindBase {
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
}



/**
 * A workspace's pane kinds. Each workspace (store) has its own, so two workspaces on one page, a workspace in a dialog
 * and every test are independent: nothing about kinds is process-wide. `register` after creation is for late imports
 * and HMR; caches of kind-derived values key on `version()`.
 */
export interface PaneKinds<D extends PaneKindBase = PaneKindBase> {
  register(def: D): void;
  get(kind: string): D | undefined;
  /** Bumped by every registration. */
  version(): number;
  onChange(l: () => void): () => void;
  /** The framework-free view, for layout-core (resolve, validate, decode). Same object per version. */
  registry(): KindRegistry;
  /** Title for a ref, falling back to the kind name when the kind is unknown. */
  title(ref: ObjectRef): string;
  /** The ref's identity as text, or undefined for scratch kinds. */
  identityOf(ref: ObjectRef): string | undefined;
  /** Same object: same object type (kind, unless the kind says otherwise) and identity. Scratch refs are never the
   *  same object as anything. */
  sameObject(a: ObjectRef, b: ObjectRef): boolean;
  /** Same entry in Recent: the same object, or (scratch kinds) the same params. */
  sameRecent(a: ObjectRef, b: ObjectRef): boolean;
  isRecordable(ref: ObjectRef): boolean;
  isTransient(ref: ObjectRef): boolean;
}

/** Params as order-free text, so ids compare as text (`1` equals `"1"`). */
const asText = (params: ObjectRef["params"]) => JSON.stringify(Object.keys(params).sort().map((k) => [k, String(params[k])]));

export function createPaneKinds<D extends PaneKindBase = PaneKindBase>(defs: readonly D[] = []): PaneKinds<D> {
  const kinds = new Map<string, D>(defs.map((d) => [d.kind, d]));
  const listeners = new Set<() => void>();
  let version = 0;
  let cached: { version: number; value: KindRegistry } | null = null;

  const identityOf = (ref: ObjectRef): string | undefined => {
    const def = kinds.get(ref.kind);
    if (!def?.identity) return asText(ref.params);
    const id = def.identity(ref);
    return id === undefined ? undefined : JSON.stringify(id);
  };
  const objectType = (ref: ObjectRef) => kinds.get(ref.kind)?.object ?? ref.kind;

  return {
    register(def) {
      kinds.set(def.kind, def);
      version++;
      for (const l of listeners) l();
    },
    get: (kind) => kinds.get(kind),
    version: () => version,
    onChange(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    registry() {
      if (cached?.version === version) return cached.value;
      const value: KindRegistry = {};
      for (const d of kinds.values()) {
        const k: PaneKind = { kind: d.kind, title: d.title, minWidth: d.minWidth, minHeight: d.minHeight };
        if (d.maxWidth !== undefined) k.maxWidth = d.maxWidth;
        if (d.comfortableWidth !== undefined) k.comfortableWidth = d.comfortableWidth;
        value[d.kind] = k;
      }
      cached = { version, value };
      return value;
    },
    title(ref) {
      const def = kinds.get(ref.kind);
      try {
        return def ? def.title(ref) : ref.kind;
      } catch {
        return ref.kind;
      }
    },
    identityOf,
    sameObject(a, b) {
      if (objectType(a) !== objectType(b)) return false;
      const ia = identityOf(a);
      return ia !== undefined && ia === identityOf(b);
    },
    sameRecent: (a, b) => a.kind === b.kind && (identityOf(a) ?? asText(a.params)) === (identityOf(b) ?? asText(b.params)),
    isRecordable(ref) {
      const r = kinds.get(ref.kind)?.recordable;
      return typeof r === "function" ? r(ref) : r !== false;
    },
    isTransient: (ref) => !!kinds.get(ref.kind)?.transient,
  };
}
