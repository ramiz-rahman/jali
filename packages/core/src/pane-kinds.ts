/**
 * Pane kinds: what an app says about each kind of pane (its params, title, sizes and identity), and the registry a
 * workspace keeps of them. A framework adapter adds the view: @jali/react's `definePane` adds `Component` and `icon`.
 */
import type { KindRegistry, ObjectRef, PaneKind } from "./layout/types";

// ---------- params ----------

export type ParamValue = string | number;
export type Params = Record<string, ParamValue>;

/**
 * How to read one param. A link turns values into text, so a kind names the type it expects back: `Number`, `String`,
 * or any function from a param value to a param value.
 */
export type ParamType = (value: ParamValue) => ParamValue;
export type ParamTypes = Record<string, ParamType>;

/**
 * The params a kind's code sees: the ones it declares, typed (`{ id: Number }` gives `id: number`), and any others as
 * plain values. Declare the params every ref of the kind has; read optional ones as plain values.
 */
export type ParamsOf<T> = [T] extends [ParamTypes] ? { [K in keyof T]: ReturnType<T[K]> } & Params : Params;

/** `params` read with `types`. Params the kind does not declare pass through as they are. */
export function readParams(types: ParamTypes | undefined, params: Params): Params {
  if (!types) return params;
  const out: Params = { ...params };
  for (const [key, type] of Object.entries(types)) {
    if (params[key] !== undefined) out[key] = type(params[key]);
  }
  return out;
}

// ---------- commands and activity ----------

/**
 * A command a pane adds to ⌘K while it is focused ("Run query", "Save"). `keys` is the label only: the content
 * handles its own keys. `disabled` greys it out, with the reason read to screen readers.
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

// ---------- a kind ----------

/** Widths in px. A pane folds into a tab rather than go below its minimum. */
export interface PaneWidth {
  /** The narrowest the content still works at. Default 240. */
  min?: number;
  /** Where spare space takes the pane first, before any sibling grows past its own. Default: `min`. */
  comfortable?: number;
  /** The widest the content usefully uses: spare space past it goes to the neighbours first. Default: none. */
  max?: number;
}

/** Heights in px. */
export interface PaneHeight {
  /** The shortest the content still works at. Default 160. */
  min?: number;
}

export const DEFAULT_MIN_WIDTH = 240;
export const DEFAULT_MIN_HEIGHT = 160;

/** What an app says about a kind of pane, apart from how it renders. `P` is the type of its params. */
export interface PaneOptions<P = Params> {
  /** How to read each param back from a link: `{ id: Number }`. Without it, params are `string | number`. */
  params?: ParamTypes;
  /** The pane's title in its header, its tab and ⌘K. */
  title: string | ((params: P) => string);
  width?: PaneWidth;
  height?: PaneHeight;
  /** The type of object shown, when several kinds show the same objects differently. Two panes show the same
   *  object when this and their identities match. Default: the kind. */
  shows?: string;
  /** What makes two panes of this kind the same object. Default: every param, compared as text (`1` equals `"1"`). */
  identity?: (params: P) => unknown;
  /** Every pane is new (a scratch note): never matched against an open pane, never listed in Recent. */
  scratch?: boolean;
  /** Listed in Recent. Default true (false for scratch kinds). */
  inRecent?: boolean | ((params: P) => boolean);
  /** Keep the content as it is while a divider is dragged, and reflow once on release: for long lists and charts. */
  holdWhileResizing?: boolean;
}

/** A kind as the workspace keeps it. `transient` is set by the workspace on its launcher. */
export interface PaneKindBase extends PaneOptions<never> {
  kind: string;
  transient?: boolean;
}

/** A defined kind. Call it to name an object of the kind: `note({ id: 2 })` is `{ kind: "note", params: { id: 2 } }`. */
export type PaneDefinition<P = Params, D extends PaneKindBase = PaneKindBase> = D & {
  (...params: {} extends P ? [params?: P] : [params: P]): ObjectRef;
  readonly kind: string;
};

/** Gives a kind the call that builds its refs. Framework adapters build `definePane` on this. */
export function defineKind<P, D extends PaneKindBase>(def: D): PaneDefinition<P, D> {
  const ref = (params: Params = {}): ObjectRef => ({ kind: def.kind, params: { ...params } });
  return Object.assign(ref, def) as unknown as PaneDefinition<P, D>;
}

// ---------- the registry ----------

/**
 * A workspace's pane kinds. Each workspace has its own, so two workspaces on one page, a workspace in a dialog and
 * every test are independent. `register` after creation is for late imports and HMR; caches key on `version()`.
 */
export interface PaneKinds<D extends PaneKindBase = PaneKindBase> {
  register(def: D): void;
  get(kind: string): D | undefined;
  /** Bumped by every registration. */
  version(): number;
  onChange(l: () => void): () => void;
  /** The framework-free view, for the layout (resolve, validate, decode). Same object per version. */
  registry(): KindRegistry;
  /** `ref`'s params, read with its kind's param types. */
  params(ref: ObjectRef): Params;
  /** Title for a ref, falling back to the kind name when the kind is unknown. */
  title(ref: ObjectRef): string;
  /** The ref's identity as text, or undefined for scratch kinds. */
  identityOf(ref: ObjectRef): string | undefined;
  /** Same object: the same object type (`shows`, else the kind) and identity. Scratch refs match nothing. */
  sameObject(a: ObjectRef, b: ObjectRef): boolean;
  /** Same entry in Recent: the same object, or (scratch kinds) the same params. */
  sameRecent(a: ObjectRef, b: ObjectRef): boolean;
  isRecordable(ref: ObjectRef): boolean;
  isTransient(ref: ObjectRef): boolean;
}

/** Params as order-free text, so ids compare as text (`1` equals `"1"`). */
const asText = (params: Params) => JSON.stringify(Object.keys(params).sort().map((k) => [k, String(params[k])]));

/** A kind's own functions take its typed params; the registry calls them with the params it read. */
type Fn<R> = ((params: Params) => R) | undefined;

export function createPaneKinds<D extends PaneKindBase = PaneKindBase>(defs: readonly D[] = []): PaneKinds<D> {
  // Copies, so the registry holds plain data rather than each definition's call.
  const kinds = new Map<string, D>(defs.map((d) => [d.kind, { ...d }]));
  const listeners = new Set<() => void>();
  let version = 0;
  let cached: { version: number; value: KindRegistry } | null = null;

  const params = (ref: ObjectRef) => readParams(kinds.get(ref.kind)?.params, ref.params);

  const title = (ref: ObjectRef): string => {
    const def = kinds.get(ref.kind);
    if (!def) return ref.kind;
    if (typeof def.title === "string") return def.title;
    try {
      return (def.title as Fn<string>)!(params(ref));
    } catch {
      return ref.kind;
    }
  };

  const identityOf = (ref: ObjectRef): string | undefined => {
    const def = kinds.get(ref.kind);
    if (def?.scratch) return undefined;
    const identity = def?.identity as Fn<unknown>;
    if (!identity) return asText(ref.params);
    const id = identity(params(ref));
    return id === undefined ? undefined : JSON.stringify(id);
  };

  const objectType = (ref: ObjectRef) => kinds.get(ref.kind)?.shows ?? ref.kind;

  return {
    register(def) {
      kinds.set(def.kind, { ...def });
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
        const k: PaneKind = {
          kind: d.kind,
          title,
          minWidth: d.width?.min ?? DEFAULT_MIN_WIDTH,
          minHeight: d.height?.min ?? DEFAULT_MIN_HEIGHT,
        };
        if (d.width?.max !== undefined) k.maxWidth = d.width.max;
        if (d.width?.comfortable !== undefined) k.comfortableWidth = d.width.comfortable;
        value[d.kind] = k;
      }
      cached = { version, value };
      return value;
    },
    params,
    title,
    identityOf,
    sameObject(a, b) {
      if (objectType(a) !== objectType(b)) return false;
      const ia = identityOf(a);
      return ia !== undefined && ia === identityOf(b);
    },
    sameRecent: (a, b) => a.kind === b.kind && (identityOf(a) ?? asText(a.params)) === (identityOf(b) ?? asText(b.params)),
    isRecordable(ref) {
      const def = kinds.get(ref.kind);
      const inRecent = def?.inRecent as boolean | Fn<boolean>;
      if (typeof inRecent === "function") return inRecent(params(ref));
      return inRecent ?? !def?.scratch;
    },
    isTransient: (ref) => !!kinds.get(ref.kind)?.transient,
  };
}
