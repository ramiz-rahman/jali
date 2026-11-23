/**
 * What a public action takes, checked where it comes in. An app's TypeScript is checked by the compiler; a call from
 * JavaScript, a key binding's arguments or a model's tool call (whose arguments are JSON) is not.
 * Each public step declares one check per argument (`checked([...], step)`), and the step's own argument types are
 * read from those checks, so the two can't drift. A value that won't do is refused as `"invalid"` before the step
 * runs: the same refusal for every caller, never a throw and never a value stored as given.
 */
import type { Edge, ObjectRef } from "../layout/types";
import type { ItemId } from "../profile";
import { checkRef } from "../pane-kinds";
import { refuse, type Outcome, type RefusalStep, type Snapshot } from "../state/apply";
import { say } from "../state/messages";
import type { PaneTarget } from "./public";

declare const VALUE: unique symbol;

/** A check of one argument: a refusal when `v` won't do, else undefined. `V` is the type it lets through. */
export interface Arg<V> {
  (x: Snapshot, v: unknown): RefusalStep | undefined;
  readonly [VALUE]?: V;
}
/** A check of an argument that may be left out (trailing only). */
export interface OptionalArg<V> extends Arg<V | undefined> {
  readonly optional: true;
}

/** The arguments a list of checks lets through, optional ones optional. */
export type ArgsOf<A extends readonly unknown[]> = A extends readonly [infer H, ...infer R]
  ? H extends OptionalArg<infer V>
    ? [V?, ...ArgsOf<R>]
    : H extends Arg<infer V>
      ? [V, ...ArgsOf<R>]
      : never
  : [];

/** A step whose arguments are checked before it runs. `args` are its checks, in order. */
export type CheckedStep<P extends unknown[]> = ((x: Snapshot, ...a: P) => Outcome) & {
  readonly args: readonly Arg<unknown>[];
};

const INVALID: RefusalStep = /* @__PURE__ */ refuse("invalid");
const is =
  <V>(test: (v: unknown) => boolean): Arg<V> =>
  (_x, v) =>
    test(v) ? undefined : INVALID;

/** What is wrong with `ref`, in the instance's words; undefined when nothing is. `known: false`: any kind will do. */
function refProblem(x: Snapshot, ref: unknown, known: boolean): RefusalStep | undefined {
  if (checkRef(x.env.kinds, ref, { known: false })) return refuse("invalid", say(x).invalidRef);
  return known && checkRef(x.env.kinds, ref)
    ? refuse("invalid", say(x).unknownKind((ref as ObjectRef).kind))
    : undefined;
}

const plainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A pane: its id, or a ref of any kind (the pane showing that object). */
export const target: Arg<PaneTarget> = (x, v) =>
  typeof v === "string" ? undefined : refProblem(x, v, false);
/** An object to show: a ref of one of the instance's kinds. */
export const ref: Arg<ObjectRef> = (x, v) => refProblem(x, v, true);
export const bool: Arg<boolean> = /* @__PURE__ */ is((v) => typeof v === "boolean");
export const text: Arg<string> = /* @__PURE__ */ is((v) => typeof v === "string");
export const integer: Arg<number> = /* @__PURE__ */ is((v) => Number.isInteger(v));
/** A curated page's item: text, or a finite number (`ItemId`). */
export const item: Arg<ItemId> = /* @__PURE__ */ is(
  (v) => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)),
);
/** An object the step reads itself (a settings patch, the chooser's request): only its being one is checked here. */
export const object = <V extends object>(): Arg<V> => is(plainObject);

/** One of `values`. */
export const oneOf = <const V extends string>(...values: readonly V[]): Arg<V> =>
  is((v) => (values as readonly unknown[]).includes(v));
export const edge: Arg<Edge> = /* @__PURE__ */ oneOf("left", "right", "top", "bottom");

/** `check`, or null. */
export const nullable =
  <V>(check: Arg<V>): Arg<V | null> =>
  (x, v) =>
    v === null ? undefined : check(x, v);

/** `check`, or left out (undefined). */
export const optional = <V>(check: Arg<V>): OptionalArg<V> =>
  Object.assign((x: Snapshot, v: unknown) => (v === undefined ? undefined : check(x, v)), {
    optional: true as const,
  });

type Shape = Record<string, Arg<unknown>>;
type ShapeOf<S extends Shape> = {
  [K in keyof S as S[K] extends OptionalArg<unknown> ? never : K]: S[K] extends Arg<infer V>
    ? V
    : never;
} & {
  [K in keyof S as S[K] extends OptionalArg<unknown> ? K : never]?: S[K] extends OptionalArg<
    infer V
  >
    ? V
    : never;
};

/** An options object: each named field checked; fields it doesn't name are ignored. */
export const shape =
  <S extends Shape>(fields: S): Arg<ShapeOf<S>> =>
  (x, v) => {
    if (!plainObject(v)) return INVALID;
    for (const [key, check] of Object.entries(fields)) {
      const problem = check(x, Object.hasOwn(v, key) ? v[key] : undefined);
      if (problem) return problem;
    }
    return undefined;
  };

/** `step`, run only once each argument passes its check in `args`. */
export function checked<const A extends readonly Arg<unknown>[]>(
  args: A,
  step: (x: Snapshot, ...a: ArgsOf<A>) => Outcome,
): CheckedStep<ArgsOf<A>> {
  const run = (x: Snapshot, ...a: ArgsOf<A>): Outcome => {
    for (let i = 0; i < args.length; i++) {
      const problem = args[i]!(x, a[i]);
      if (problem) return problem;
    }
    return step(x, ...a);
  };
  return Object.assign(run, { args });
}
