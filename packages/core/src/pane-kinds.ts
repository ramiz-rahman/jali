/**
 * Pane kinds: what an app says about each kind of pane (its params, title, sizes and identity), and the registry a
 * workspace keeps of them. A framework adapter adds the view: @jali/react's `definePane` adds `Component` and `icon`.
 */
import type { KindRegistry, NodeId, ObjectRef, PaneKind } from "./layout/types";

// ---------- params ----------

/** One param's value, as a ref holds it and every link carries it. */
export type ParamValue = string | number | boolean;
export type Params = Record<string, ParamValue>;

/**
 * How to read one param. A link can turn values into text, so a kind names the type it expects back: `Number`,
 * `String`, `Boolean`, `oneOf(...)`, or any function from a param value to the value the kind wants. A function
 * says a value can't be read by returning `undefined` or `NaN`, or by throwing.
 */
export type ParamType = (value: ParamValue) => ParamValue | undefined;

/** A param a ref may leave out: `optional(String)`. The kind's code sees it as `T | undefined`. */
export interface OptionalParam<T extends ParamType = ParamType> {
  readonly optional: T;
}

/** A kind's `params`: how each is read, and whether a ref may leave it out. */
export type ParamTypes = Record<string, ParamType | OptionalParam>;

/** A param a ref may leave out: `params: { id: Number, tab: optional(String) }` gives `{ id: number; tab?: string }`. */
export function optional<T extends ParamType>(type: T): OptionalParam<T> {
  return { optional: type };
}

/** A param that is one of a few values: `oneOf("open", "closed")` gives `"open" | "closed"`. */
export type OneOf<V extends string | number> = ((value: ParamValue) => V | undefined) & {
  readonly values: readonly V[];
};

/** A param that is one of a few values, compared as text: `status: oneOf("open", "closed")`. */
export function oneOf<const V extends readonly (string | number)[]>(
  ...values: V
): OneOf<V[number]> {
  const read = (value: ParamValue) => values.find((v) => String(v) === String(value));
  return Object.assign(read, { values: [...values] });
}

type IsAny<T> = 0 extends 1 & T ? true : false;
type ReadAs<T> =
  T extends OptionalParam<infer U>
    ? ReadAs<U>
    : T extends (value: never) => infer R
      ? Exclude<R, undefined>
      : never;
type RequiredKeys<T> = { [K in keyof T]: T[K] extends OptionalParam ? never : K }[keyof T];
type OptionalKeys<T> = { [K in keyof T]: T[K] extends OptionalParam ? K : never }[keyof T];

/**
 * The params a kind's code sees, from its `params`: `ParamsOf<{ id: NumberConstructor }>` is `{ id: number }`, and an
 * `optional(...)` param is optional. Without a declaration, params are plain values (`Params`).
 */
export type ParamsOf<T> =
  IsAny<T> extends true
    ? any // eslint-disable-line @typescript-eslint/no-explicit-any
    : [T] extends [ParamTypes]
      ? { [K in RequiredKeys<T>]: ReadAs<T[K]> } & {
          [K in OptionalKeys<T>]?: ReadAs<T[K]>;
        } extends infer O
        ? { [K in keyof O]: O[K] }
        : never
      : Params;

/** A param a ref is missing (`value` undefined) or holds a value its type can't read. */
export interface ParamProblem {
  param: string;
  value?: ParamValue;
}

const isValue = (v: unknown): v is ParamValue =>
  typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));

/** One value read with its type, or undefined when the type can't read it. */
function readOne(type: ParamType, value: ParamValue): ParamValue | undefined {
  if ((type as unknown) === Number) {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
          ? Number(value)
          : NaN;
    return Number.isFinite(n) ? n : undefined;
  }
  if ((type as unknown) === String) return String(value);
  // A link can carry a flag as text, and older links as 1 or 0.
  if ((type as unknown) === Boolean) {
    if (value === true || value === "true" || value === 1 || value === "1") return true;
    if (value === false || value === "false" || value === 0 || value === "0") return false;
    return undefined;
  }
  try {
    const out = type(value);
    return isValue(out) ? out : undefined;
  } catch {
    return undefined;
  }
}

const typeOf = (t: ParamType | OptionalParam): { type: ParamType; optional: boolean } =>
  typeof t === "function" ? { type: t, optional: false } : { type: t.optional, optional: true };

/**
 * `params` read with `types`: each declared param in its type. Params the kind does not declare pass through as they
 * are. `problems` lists each required param that is missing and each value its type can't read (kept as it was).
 */
export function parseParams(
  types: ParamTypes | undefined,
  params: Params,
): { params: Params; problems: ParamProblem[] } {
  const problems: ParamProblem[] = [];
  if (!types) return { params, problems };
  const out: Params = { ...params };
  for (const [key, declared] of Object.entries(types)) {
    const { type, optional } = typeOf(declared);
    const value = params[key];
    if (value === undefined) {
      if (!optional) problems.push({ param: key });
      continue;
    }
    const read = readOne(type, value);
    if (read === undefined) problems.push({ param: key, value });
    else out[key] = read;
  }
  return { params: out, problems };
}

/** `params` read with `types` (see `parseParams`). */
export function readParams(types: ParamTypes | undefined, params: Params): Params {
  return parseParams(types, params).params;
}

/** What is wrong with a ref's params, in a sentence for logs and the layout validator; undefined when nothing is. */
export function describeProblems(problems: readonly ParamProblem[]): string | undefined {
  if (!problems.length) return undefined;
  return problems
    .map((p) =>
      p.value === undefined
        ? `"${p.param}" is missing`
        : `"${p.param}" can't be read from ${JSON.stringify(p.value)}`,
    )
    .join("; ");
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

/** Which pane failed (`createJali({ onPaneError })`): its id, null in the peek sheet, and what it was showing. */
export interface PaneErrorInfo {
  pane: NodeId | null;
  ref: ObjectRef;
}

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
  /** How to read each param back from a link: `{ id: Number, tab: optional(String) }`. A ref missing a required
   *  param, or holding a value its type can't read, does not open: see the Pane kinds guide. Without `params`,
   *  params are plain values. */
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
  // An optional param given as `undefined` is left out, as a link would leave it.
  const ref = (params: Record<string, ParamValue | undefined> = {}): ObjectRef => ({
    kind: def.kind,
    params: Object.fromEntries(
      Object.entries(params).filter((e): e is [string, ParamValue] => e[1] !== undefined),
    ),
  });
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
  /** What is wrong with `ref`'s params for its kind: required params it is missing, values its types can't read. */
  problems(ref: ObjectRef): ParamProblem[];
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
const asText = (params: Params) =>
  JSON.stringify(
    Object.keys(params)
      .sort()
      .map((k) => [k, String(params[k])]),
  );

/** A kind's own functions take its typed params; the registry calls them with the params it read. */
type Fn<R> = ((params: Params) => R) | undefined;

export function createPaneKinds<D extends PaneKindBase = PaneKindBase>(
  defs: readonly D[] = [],
): PaneKinds<D> {
  // Copies, so the registry holds plain data rather than each definition's call.
  const kinds = new Map<string, D>(defs.map((d) => [d.kind, { ...d }]));
  const listeners = new Set<() => void>();
  let version = 0;
  let cached: { version: number; value: KindRegistry } | null = null;

  const parsed = (ref: ObjectRef) => parseParams(kinds.get(ref.kind)?.params, ref.params);
  const params = (ref: ObjectRef) => parsed(ref).params;
  const problems = (ref: ObjectRef) => parsed(ref).problems;

  const title = (ref: ObjectRef): string => {
    const def = kinds.get(ref.kind);
    if (!def) return ref.kind;
    if (typeof def.title === "string") return def.title;
    // A ref its kind can't read has no title of its own: the pane says what is wrong instead.
    if (problems(ref).length) return ref.kind;
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
    if (!identity || problems(ref).length) return asText(ref.params);
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
        const types = d.params;
        if (types) k.checkParams = (p) => describeProblems(parseParams(types, p).problems);
        value[d.kind] = k;
      }
      cached = { version, value };
      return value;
    },
    params,
    problems,
    title,
    identityOf,
    sameObject(a, b) {
      if (objectType(a) !== objectType(b)) return false;
      const ia = identityOf(a);
      return ia !== undefined && ia === identityOf(b);
    },
    sameRecent: (a, b) =>
      a.kind === b.kind &&
      (identityOf(a) ?? asText(a.params)) === (identityOf(b) ?? asText(b.params)),
    isRecordable(ref) {
      const def = kinds.get(ref.kind);
      if (problems(ref).length) return false;
      const inRecent = def?.inRecent as boolean | Fn<boolean>;
      if (typeof inRecent === "function") return inRecent(params(ref));
      return inRecent ?? !def?.scratch;
    },
    isTransient: (ref) => !!kinds.get(ref.kind)?.transient,
  };
}
