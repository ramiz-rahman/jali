/**
 * Pane kinds: what an app says about each kind of pane (its params, title, sizes and identity), and the registry a
 * instance keeps of them. A framework adapter adds the view: @jali/react's `definePane` adds `Component` and `icon`.
 */
import type { KindRegistry, Layout, NodeId, ObjectRef, PaneKind, ViewState } from "./layout/types";
import { map } from "./layout/tree/tree";
import { own } from "./own";
import { isStandardSchema, type StandardSchemaV1 } from "./standard-schema";

declare const process: { env: { NODE_ENV?: string } };

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
  /** `false`: the pane's own, kept out of the address (`optional(String, { link: false })`). */
  readonly link?: false;
}

/** How an optional param travels: `optional(String, { link: false })`. */
export interface ParamOptions {
  /**
   * `false`: the param is the pane's own state for this page load, and stays out of the address. Jali leaves it out
   * of every link it writes (the address, Copy link, Back and Forward), as for `appOnly`; unlike `appOnly`, it is part
   * of what the pane shows (two refs that differ in it are two objects), and a link that does carry it still sets it.
   * Back and Forward keep it on a pane that is still open: a run id, a draft's key, a value that means nothing in
   * another tab. Default: the param is in the link.
   */
  link?: false;
}

/** A kind's `params`, one by one: how each is read, and whether a ref may leave it out. */
export type ParamTypes = Record<string, ParamType | OptionalParam>;

/**
 * A kind's `params`: one by one with Jali's constructors (`{ id: Number, tab: optional(String) }`), or one Standard
 * Schema of the whole object from any library that implements it (`v.object({ id: v.number() })`, `z.object(…)`). A schema decides
 * what is valid, and its output is what the pane gets; Jali's codec still decides how values are written in a link.
 * `appOnly` and `link: false` are Jali's: give params one by one to use them.
 */
export type ParamsDeclaration = ParamTypes | StandardSchemaV1<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * A param a ref may leave out: `params: { id: Number, tab: optional(String) }` gives `{ id: number; tab?: string }`.
 * `{ link: false }` keeps it out of the address (`ParamOptions`).
 */
export function optional<T extends ParamType>(type: T, options?: ParamOptions): OptionalParam<T> {
  return options?.link === false ? { optional: type, link: false } : { optional: type };
}

/** A param only the app sets: `appOnly(Boolean)`. Links never carry it (see `appOnly`). */
export interface AppOnlyParam<T extends ParamType = ParamType> extends OptionalParam<T> {
  readonly appOnly: true;
}

/**
 * A param only the app sets, never a link: `params: { sql: String, autorun: appOnly(Boolean) }`. Jali leaves it out
 * of every link it writes (the address, Copy link, Back and Forward) and drops it from every link it reads, so a link
 * can't set it: a query that runs as it opens, an edit mode, a permission. It is optional, since a pane opened from a
 * link has none, and it is not part of what the pane shows: two refs that differ only in it are the same object.
 */
export function appOnly<T extends ParamType>(type: T): AppOnlyParam<T> {
  return { optional: type, appOnly: true };
}

const isAppOnly = (t: ParamType | OptionalParam): boolean =>
  typeof t !== "function" && (t as Partial<AppOnlyParam>).appOnly === true;

/** A declaration's params one by one; none for a schema of the whole object. */
const oneByOne = (types: ParamsDeclaration | undefined) =>
  isStandardSchema(types) ? undefined : (types as ParamTypes | undefined);

/** The params of `types` that only the app sets (`appOnly`). */
export const appOnlyParams = (declared: ParamsDeclaration | undefined): string[] => {
  const types = oneByOne(declared);
  return types ? Object.keys(types).filter((k) => isAppOnly(types[k]!)) : [];
};

/** The params of `types` kept out of the address but not out of what the pane shows (`link: false`). */
export const unlinkedParams = (declared: ParamsDeclaration | undefined): string[] => {
  const types = oneByOne(declared);
  return types
    ? Object.keys(types).filter((k) => {
        const t = types[k]!;
        return typeof t !== "function" && t.link === false && !isAppOnly(t);
      })
    : [];
};

/** `params` without those named in `drop`; the same object when it has none of them. */
function without(params: Params, drop: readonly string[] | undefined): Params {
  if (!drop?.some((k) => Object.hasOwn(params, k))) return params;
  const out: Params = { ...params };
  for (const k of drop) delete out[k];
  return out;
}

/** `ref` without the params `drop` names for its kind; the same ref when it has none. */
function dropParams(
  kinds: KindRegistry,
  ref: ObjectRef,
  drop: (k: PaneKind) => readonly string[] | undefined,
): ObjectRef {
  const kind = Object.hasOwn(kinds, ref.kind) ? kinds[ref.kind]! : undefined;
  const names = kind ? drop(kind) : undefined;
  const params = without(ref.params, names);
  return params === ref.params ? ref : { ...ref, params };
}

/** Every pane's ref in `layout` through `fn`; the same layout when none changes. */
function mapRefs(layout: Layout, fn: (ref: ObjectRef, id: string) => ObjectRef): Layout {
  const root = map(layout.root, (n) => {
    if (n.type !== "pane") return n;
    const ref = fn(n.ref, n.id);
    return ref === n.ref ? n : { ...n, ref };
  });
  return root === layout.root ? layout : { ...layout, root };
}

const written = (k: PaneKind) => (k.unlinked ? [...(k.appOnly ?? []), ...k.unlinked] : k.appOnly);

/** `ref` as a link carries it: without its kind's app-only and `link: false` params. The same ref when it has none. */
export function linkRef(kinds: KindRegistry, ref: ObjectRef): ObjectRef {
  return dropParams(kinds, ref, written);
}

/** `layout` as a link carries it: every pane's ref as `linkRef` gives it. The same layout when none has any. */
export function linkLayout(kinds: KindRegistry, layout: Layout): Layout {
  return mapRefs(layout, (ref) => linkRef(kinds, ref));
}

/**
 * Refs a link gave for a kind not registered when it was read. Which of their params only the app sets can't be known
 * yet, so they are kept whole (the pane says its kind is missing) and read again once the kind is registered
 * (`rereadRef`): a link must never set an app-only param, whenever its kind arrives.
 */
const unreadRefs = /* @__PURE__ */ new WeakSet<ObjectRef>();

/** `ref` as read from a link: without app-only params, which a link never sets. A `link: false` param it carries is
 *  kept. A ref of a kind not registered yet is kept as it is, and read again when the kind is (`rereadRef`). */
export function readRef(kinds: KindRegistry, ref: ObjectRef): ObjectRef {
  if (!Object.hasOwn(kinds, ref.kind)) unreadRefs.add(ref);
  return dropParams(kinds, ref, (k) => k.appOnly);
}

/** `ref` read again, if a link gave it before its kind was registered and the kind is now: without its app-only
 *  params. Any other ref, the same ref. */
export function rereadRef(kinds: KindRegistry, ref: ObjectRef): ObjectRef {
  return unreadRefs.has(ref) && Object.hasOwn(kinds, ref.kind)
    ? dropParams(kinds, ref, (k) => k.appOnly)
    : ref;
}

/** `layout` with every pane's ref as `rereadRef` gives it. The same layout when none changes. */
export function rereadLayout(kinds: KindRegistry, layout: Layout): Layout {
  return mapRefs(layout, (ref) => rereadRef(kinds, ref));
}

/** `layout` as read from a link: every pane's ref as `readRef` gives it. */
export function readLayout(kinds: KindRegistry, layout: Layout): Layout {
  return mapRefs(layout, (ref) => readRef(kinds, ref));
}

/**
 * `layout` from the address, with the params the address doesn't hold (`appOnly` and `link: false`) put back from the
 * app's own layouts: a pane that has none of them takes them from the first of `from` with a pane of the same id and
 * kind showing the same object apart from them. `from` is the layout on screen (so Back and Forward keep them on a
 * pane that is still open), then the preset the link names (so a reload keeps what the preset gave its panes). Only
 * the app's layouts are read, and only an exact match takes anything, so a link still can't set an app-only param.
 */
export function keepOwnParams(
  kinds: KindRegistry,
  layout: Layout,
  from: readonly (Layout | undefined)[],
): Layout {
  const owners = from.map((l) => {
    const refs = new Map<string, ObjectRef>();
    if (l)
      map(l.root, (n) => {
        if (n.type === "pane") refs.set(n.id, n.ref);
        return n;
      });
    return refs;
  });
  return mapRefs(layout, (ref, id) =>
    keepOwnRef(
      kinds,
      ref,
      owners.map((refs) => refs.get(id)),
    ),
  );
}

/**
 * `ref` from the address, with the params the address doesn't hold (`appOnly` and `link: false`) put back from the
 * first of `owners` (the app's own refs) of the same kind showing the same object apart from them; else `ref`. A ref
 * that holds any of those params already is left as it is.
 */
export function keepOwnRef(
  kinds: KindRegistry,
  ref: ObjectRef,
  owners: Iterable<ObjectRef | undefined>,
): ObjectRef {
  const kind = Object.hasOwn(kinds, ref.kind) ? kinds[ref.kind]! : undefined;
  const names = kind && written(kind);
  if (!names?.length || names.some((k) => Object.hasOwn(ref.params, k))) return ref;
  for (const before of owners) {
    if (!before || before.kind !== ref.kind) continue;
    if (asText(without(before.params, names)) !== asText(ref.params)) continue;
    const kept = names.filter((k) => Object.hasOwn(before.params, k));
    if (!kept.length) return ref;
    const params = { ...ref.params };
    for (const k of kept) params[k] = before.params[k]!;
    return { ...ref, params };
  }
  return ref;
}

/** `view` as a link carries it: its peek without app-only params. */
export function linkView(kinds: KindRegistry, view: ViewState): ViewState {
  const peek = view.peek && linkRef(kinds, view.peek);
  return peek === view.peek ? view : { ...view, peek };
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
 * `optional(...)` param is optional. A Standard Schema of the whole object gives its output type.
 * Without a declaration, params are plain values (`Params`).
 */
export type ParamsOf<T> =
  IsAny<T> extends true
    ? any // eslint-disable-line @typescript-eslint/no-explicit-any
    : [T] extends [StandardSchemaV1]
      ? StandardSchemaV1.InferOutput<T> extends infer O
        ? { [K in keyof O]: O[K] }
        : never
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
 * `params` through a schema of the whole object. Its output is what the pane gets; params it leaves out (a schema
 * that strips unknown keys) pass through, as undeclared params do. Each issue is a problem with the param its path
 * starts with.
 */
function parseWithSchema(
  schema: StandardSchemaV1,
  params: Params,
): { params: Params; problems: ParamProblem[] } {
  const r = schema["~standard"].validate(params);
  // A schema that validates asynchronously can't read a link: a pane's params are read as it renders.
  if (r instanceof Promise) return { params, problems: [{ param: "params" }] };
  if (r.issues)
    return {
      params,
      problems: r.issues.map((i) => {
        const first = i.path?.[0];
        const param = String((first as { key?: PropertyKey })?.key ?? first ?? "params");
        const value = own(params, param);
        return value === undefined ? { param } : { param, value };
      }),
    };
  return { params: { ...params, ...(r.value as Params) }, problems: [] };
}

/**
 * `params` read with `types`: each declared param in its type. Params the kind does not declare pass through as they
 * are. `problems` lists each required param that is missing and each value its type can't read (kept as it was).
 */
export function parseParams(
  types: ParamsDeclaration | undefined,
  params: Params,
): { params: Params; problems: ParamProblem[] } {
  const problems: ParamProblem[] = [];
  if (!types) return { params, problems };
  if (isStandardSchema(types)) return parseWithSchema(types, params);
  const out: Params = { ...params };
  for (const [key, declared] of Object.entries(types)) {
    const { type, optional } = typeOf(declared);
    const value = own(params, key);
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
export function readParams(types: ParamsDeclaration | undefined, params: Params): Params {
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

/**
 * What a pane reports about itself; shown in its header, its tab, the shelf and the status line. `"working"` is busy
 * work the person waits for; `"live"` is ongoing, healthy work that is meant to go on (recording, streaming, playback).
 */
export type PaneActivity = "idle" | "loading" | "working" | "live" | "needs-you" | "error";

/** Activities, most pressing first; `"idle"` is none of them. Live work is healthy and meant to go on, so it is the
 *  least pressing: a pane that is working or waiting for the person says so first. */
export const ACTIVITY_URGENCY: readonly PaneActivity[] = [
  "error",
  "needs-you",
  "working",
  "loading",
  "live",
];

/** The most pressing of several activities (a folded strip's tabs, a pane's several reporters), or undefined. */
export const mostPressing = (
  all: readonly (PaneActivity | undefined)[],
): PaneActivity | undefined => ACTIVITY_URGENCY.find((a) => all.includes(a));

/** `data-*` attributes a pane sets from its data (usePaneAttributes), such as `{ "data-connection": "production" }`. */
export type PaneAttributes = Record<`data-${string}`, string>;

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

/** Heights in px, with the same rules as widths, down a column. A pane folds into a tab rather than go below its
 *  minimum. */
export interface PaneHeight {
  /** The shortest the content still works at. Default 160. */
  min?: number;
  /** Where spare height takes the pane first, before any pane above or below grows past its own. Default: `min`. */
  comfortable?: number;
  /** The tallest the content usefully uses: spare height past it goes to the neighbours first. Default: none. */
  max?: number;
}

export const DEFAULT_MIN_WIDTH = 240;
export const DEFAULT_MIN_HEIGHT = 160;

/** What an app says about a kind of pane, apart from how it renders. `P` is the type of its params. */
export interface PaneOptions<P = Params> {
  /** How to read each param back from a link: `{ id: Number, tab: optional(String) }`, or a Standard Schema of the
   *  whole object (`v.object({ id: v.number() })`). A ref missing a required param, or holding a value its type
   *  can't read, does not open: see the Pane kinds guide. Without `params`, params are plain values. */
  params?: ParamsDeclaration;
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
  /**
   * What a following pane of this kind shows when its list selects an object of another kind: the params for it, or
   * `undefined` to keep what it shows. A chart that follows a watchlist of quotes:
   * `follow: (selected) => ({ symbol: selected.params.symbol })`. A follower of the selected object's own kind always
   * shows that object. Params left `undefined` are left out, and params its kind can't read keep the pane as it is.
   */
  follow?: (selected: ObjectRef) => FollowParams<P> | undefined;
  /**
   * For a list: the kind of the objects it selects (`"quote"` for a watchlist that calls `select(quote(...))`). A pane
   * of this kind with no selection yet starts on what its follower of that kind shows, when the layout gives it one:
   * at start-up, on a link, after a preset or `setLayout`. Read the selection back to put the cursor there.
   */
  selects?: string;
  /** What may happen to panes of this kind: `{ fullScreen: false }` for content that can't fill a screen. A kind can
   *  only turn controls off; the instance's `allow` decides the rest. */
  allow?: import("./actions/allow").PaneAllow;
  /** The buttons in this kind's header, replacing the instance's: a list, or a function that adjusts it
   *  (`(defaults) => defaults.filter((b) => b !== "tuck")`). Leave it out for Jali's. Everything allowed is in the pane's menu. */
  buttons?: import("./pane/buttons").PaneButtons;
  /** Phones only. `stack: false` keeps this kind out of stacked view; `place` asks for its half of it. */
  phone?: { stack?: boolean; place?: "top" | "bottom" };
}

/** What a kind's `follow` gives: its params, each one possibly missing (Jali checks them against `params`). */
export type FollowParams<P> = { [K in keyof P]?: ParamValue | undefined };

/** A kind as the instance keeps it. `transient` is set by the instance on its launcher. */
export interface PaneKindBase extends PaneOptions<never> {
  kind: string;
  transient?: boolean;
}

/**
 * An object of the kind `K`, with its params typed: what a kind's call returns (`note({ id: 2 })` is a
 * `Ref<"note", { id: number }>`). It is an `ObjectRef` too, the wide type links and agents use, which can name
 * anything; `kind` tells one kind's refs from another's, so a check of it narrows the params.
 */
export interface Ref<K extends string = string, P = Params> {
  readonly kind: K;
  readonly params: P;
}

/** The refs of an instance's kinds: each defined kind's `Ref`, and `ObjectRef` for a kind without a call. */
export type RefOf<D> = D extends { (...args: never[]): infer R extends ObjectRef } ? R : ObjectRef;

/** A defined kind. Call it to name an object of the kind: `note({ id: 2 })` is `{ kind: "note", params: { id: 2 } }`. */
export type PaneDefinition<
  P = Params,
  D extends PaneKindBase = PaneKindBase,
  K extends string = string,
> = D & {
  (...params: {} extends P ? [params?: P] : [params: P]): Ref<K, P>;
  readonly kind: K;
};

/** Gives a kind the call that builds its refs. Framework adapters build `definePane` on this. */
export function defineKind<P, D extends PaneKindBase, K extends string = string>(
  def: D & { kind: K },
): PaneDefinition<P, D, K> {
  // An optional param given as `undefined` is left out, as a link would leave it. The ref is plain data: what a link
  // may carry of it is the kind's to say (`linkRef`), so a copy is the same ref.
  const ref = (params: Record<string, ParamValue | undefined> = {}): ObjectRef => ({
    kind: def.kind,
    params: Object.fromEntries(
      Object.entries(params).filter((e): e is [string, ParamValue] => e[1] !== undefined),
    ),
  });
  return Object.assign(ref, def) as unknown as PaneDefinition<P, D, K>;
}

// ---------- the registry ----------

/**
 * An instance's pane kinds. Each instance has its own, so two instances on one page, an instance in a dialog and
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
  /** What a following pane of `kind` shows when its list selects `selected`: `selected` itself for its own kind,
   *  else what the kind's `follow` gives, when the kind can read it. Undefined: the pane keeps what it shows. */
  follow(kind: string, selected: ObjectRef): ObjectRef | undefined;
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

/**
 * A kind's sizes as the layout can use them. A size that isn't a finite number of at least 0 (`NaN`, a string, -10)
 * is left out, so the default stands; a max below the min is left out too (a comfortable size outside them is
 * clamped to them, as before).
 * Each is a development error: before, `min: NaN` put panes at NaN px.
 */
function sizesOf(
  kind: string,
  axis: "width" | "height",
  given: PaneWidth | undefined,
  dev: boolean,
) {
  const out: { min?: number; comfortable?: number; max?: number } = {};
  if (!given || typeof given !== "object") return out;
  const bad = (what: string, value: unknown) => {
    try {
      if (process.env.NODE_ENV !== "production" && dev)
        console.error(`Jali: kind "${kind}": ${axis}.${what} ${value} is left out`);
    } catch {
      /* no `process`: production */
    }
  };
  for (const key of ["min", "comfortable", "max"] as const) {
    const v = given[key as keyof PaneWidth] as unknown;
    if (v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[key] = v;
    else bad(key, String(v));
  }
  if (out.max !== undefined && out.min !== undefined && out.max < out.min) {
    bad("max", `${out.max} (below its min ${out.min})`);
    delete out.max;
  }
  return out;
}

export function createPaneKinds<D extends PaneKindBase = PaneKindBase>(
  defs: readonly D[] = [],
): PaneKinds<D> {
  // Two definitions of one kind: the last wins, as it always has, and development says so. Behind a literal
  // `NODE_ENV` test, so a production build drops it (dev.ts).
  let dev = false;
  try {
    if (process.env.NODE_ENV !== "production") {
      dev = true;
      const seen = new Set<string>();
      for (const d of defs) {
        if (seen.has(d.kind)) console.error(`Jali: kind "${d.kind}" is defined twice`);
        seen.add(d.kind);
      }
    }
  } catch {
    /* no `process`: production */
  }
  // Copies, so the registry holds plain data rather than each definition's call.
  const kinds = new Map<string, D>(defs.map((d) => [d.kind, { ...d }]));
  const listeners = new Set<() => void>();
  let version = 0;
  let cached: { version: number; value: KindRegistry } | null = null;
  // Definitions whose sizes development has checked already: each is reported once, not at every registration.
  const reported = new WeakSet<D>();

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
    // An app-only param says how the pane opens, not what it shows.
    if (!identity || problems(ref).length)
      return asText(without(ref.params, appOnlyParams(def?.params)));
    // A host's function that throws is guarded like `title` and `follow`: the pane is then the object its params
    // name, as for a kind without `identity`, so `open` and `sameObject` keep working.
    let id: unknown;
    try {
      id = identity(params(ref));
    } catch {
      return asText(without(ref.params, appOnlyParams(def?.params)));
    }
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
      // No prototype: a kind called `constructor` or `toString` is one only if it was registered.
      const value: KindRegistry = Object.create(null);
      for (const d of kinds.values()) {
        const w = sizesOf(d.kind, "width", d.width, dev && !reported.has(d)),
          h = sizesOf(d.kind, "height", d.height, dev && !reported.has(d));
        reported.add(d);
        const k: PaneKind = {
          kind: d.kind,
          title,
          minWidth: w.min ?? DEFAULT_MIN_WIDTH,
          minHeight: h.min ?? DEFAULT_MIN_HEIGHT,
        };
        if (w.max !== undefined) k.maxWidth = w.max;
        if (w.comfortable !== undefined) k.comfortableWidth = w.comfortable;
        if (h.max !== undefined) k.maxHeight = h.max;
        if (h.comfortable !== undefined) k.comfortableHeight = h.comfortable;
        const types = d.params;
        const local = appOnlyParams(types);
        if (local.length) k.appOnly = local;
        const unlinked = unlinkedParams(types);
        if (unlinked.length) k.unlinked = unlinked;
        // A link drops app-only params once read, so a value of one it can't read doesn't break the link.
        if (types)
          k.checkParams = (p) =>
            describeProblems(
              parseParams(types, p).problems.filter((pr) => !local.includes(pr.param)),
            );
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
    follow(kind, selected) {
      if (selected.kind === kind) return selected;
      const def = kinds.get(kind);
      const of = def?.follow as
        | ((s: ObjectRef) => Record<string, ParamValue | undefined> | undefined)
        | undefined;
      if (!of || !def) return undefined;
      let given: Record<string, ParamValue | undefined> | undefined;
      try {
        given = of(selected);
      } catch {
        return undefined;
      }
      if (!given) return undefined;
      const params = Object.fromEntries(
        Object.entries(given).filter((e): e is [string, ParamValue] => isValue(e[1])),
      );
      const ref = { kind, params };
      return parseParams(def.params, params).problems.length ? undefined : ref;
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

// ---------- refs from outside ----------

const plainObject = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/**
 * What is wrong with a value passed as a ref (an app's call, an agent's step), as a sentence; undefined when it is a
 * ref of a kind `kinds` has, with params that are text, finite numbers or flags. With `known: false` the kind need not
 * be one `kinds` has: a ref naming a pane only has to be well formed. A kind's own param types are not checked here: a
 * ref they can't read still opens, in the kind's `Missing` (docs/DECISIONS.md, 20 Nov 2026).
 */
export function checkRef(
  kinds: Pick<PaneKinds, "get">,
  ref: unknown,
  { known = true }: { known?: boolean } = {},
): string | undefined {
  if (!plainObject(ref) || typeof ref.kind !== "string" || !ref.kind)
    return "A ref is { kind, params }, with the kind's name";
  if (known && !kinds.get(ref.kind)) return `There is no kind "${ref.kind}"`;
  if (!plainObject(ref.params)) return "A ref needs params: { kind, params: {…} }";
  for (const [k, v] of Object.entries(ref.params))
    if (!isValue(v)) return `${ref.kind}: "${k}" must be text, a finite number or true or false`;
  return undefined;
}
