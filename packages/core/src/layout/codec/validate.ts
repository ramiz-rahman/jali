import type { KindRegistry, Layout, ObjectRef } from "../types";
import { AUTO_PREFIX } from "../fit/overlay";
import { MAX_DEPTH, MAX_NODES } from "./limits";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/**
 * A node id: letters, digits, `_`, `.`, `:` and `-`, 1 to 128 of them. Every id Jali makes (`pane-3`, `split-1`, a
 * builder's `orders-2`) fits, and so does any id written into a DOM attribute or a CSS selector without escaping.
 */
export const NODE_ID = /^[\w.:-]{1,128}$/;
/** Ids that name something on `Object.prototype`: never an id, wherever one enters (code, a preset, storage, a link). */
export const UNSAFE_IDS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);
const nodeId = (value: unknown): value is string =>
  typeof value === "string" && NODE_ID.test(value) && !UNSAFE_IDS.has(value);
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
/**
 * What is wrong with `layout` for an instance of `kinds`, or `{ ok: true }`. `params: false` leaves a kind's own param
 * types unchecked: a ref they can't read still opens, in the kind's `Missing` (an app's own layout; a link is read
 * with them). `limits: false` leaves out what a link holds (layout/codec/limits.ts): a layout of the app's own may be
 * larger than a link, and is then refused by size where it would grow (`"blocked"`), never as malformed.
 */
export function validate(
  layout: Layout,
  kinds: KindRegistry,
  { params = true, limits = true }: { params?: boolean; limits?: boolean } = {},
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  // An overlay lists nodes of the tree: no more of them than the tree may hold.
  const cap = limits ? MAX_NODES : Infinity;
  const ids = new Set<string>(),
    seen = new Set<object>();
  let count = 0;
  const error = (path: string, message: string) => errors.push(`${path}: ${message}`);
  function visit(value: unknown, path: string, depth: number, inStack = false): void {
    if (limits && (++count > MAX_NODES || depth > MAX_DEPTH)) {
      error(path, "tree is too large or deep");
      return;
    }
    if (!record(value)) {
      error(path, "expected a node");
      return;
    }
    if (seen.has(value)) {
      error(path, "cyclic or shared node");
      return;
    }
    seen.add(value);
    if (!nodeId(value.id))
      error(
        path,
        "id must be 1 to 128 letters, digits, _ . : or -, and not __proto__, constructor or prototype",
      );
    else if (ids.has(value.id)) error(path, `duplicate id ${value.id}`);
    else ids.add(value.id);
    if (
      value.legacy !== undefined ||
      value.collapsed !== undefined ||
      value.tuckedFrom !== undefined
    )
      error(path, "unsupported legacy node");
    if (
      value.base !== undefined &&
      (!record(value.base) ||
        Object.keys(value.base).length !== 1 ||
        !(positive(value.base.px) || positive(value.base.weight)))
    )
      error(path, "invalid reset size");
    const size = value.size;
    if (
      !record(size) ||
      Object.keys(size).length !== 1 ||
      !(positive(size.px) || positive(size.weight))
    )
      error(path, "size must have exactly one finite positive px or weight");
    if (value.userSized !== undefined && typeof value.userSized !== "boolean")
      error(path, "userSized must be boolean");
    if (value.type === "pane") {
      const ref = value.ref;
      if (!record(ref) || typeof ref.kind !== "string" || !Object.hasOwn(kinds, ref.kind))
        error(path, "unknown pane kind");
      if (
        !record(ref) ||
        !record(ref.params) ||
        !Object.values(ref.params).every(
          (p) =>
            typeof p === "string" ||
            typeof p === "boolean" ||
            (typeof p === "number" && Number.isFinite(p)),
        )
      )
        error(path, "invalid object params");
      else if (params && typeof ref.kind === "string" && Object.hasOwn(kinds, ref.kind)) {
        const problem = kinds[ref.kind]!.checkParams?.(ref.params as ObjectRef["params"]);
        if (problem) error(path, `invalid params for ${ref.kind}: ${problem}`);
      }
      if (value.linkedTo !== undefined && !nodeId(value.linkedTo)) error(path, "invalid linkedTo");
      if (value.kept !== undefined && typeof value.kept !== "boolean")
        error(path, "kept must be boolean");
      if (value.pinned !== undefined && typeof value.pinned !== "boolean")
        error(path, "pinned must be boolean");
      if (value.follows !== undefined && typeof value.follows !== "boolean")
        error(path, "follows must be boolean");
      if (
        value.born !== undefined &&
        !(Number.isInteger(value.born) && (value.born as number) >= 0)
      )
        error(path, "born must be a nonnegative integer");
      if (
        value.role !== undefined &&
        !(typeof value.role === "string" && value.role.length > 0 && value.role.length <= 64)
      )
        error(path, "role must be a short id");
      if (
        value.priority !== undefined &&
        value.priority !== "primary" &&
        value.priority !== "supporting"
      )
        error(path, "unknown priority");
      return;
    }
    if (inStack) {
      error(path, "stacks may contain only panes");
      return;
    }
    if (!["row", "column", "stack"].includes(value.type as string)) {
      error(path, "unknown node type");
      return;
    }
    if (!Array.isArray(value.children) || !value.children.length) {
      error(path, "children must be non-empty");
      return;
    }
    if (value.scroll !== undefined && (value.type !== "row" || value.scroll !== "x"))
      error(path, "only a row scrolls, and only sideways");
    if (value.type === "stack") {
      if (value.origin !== undefined && value.origin !== "user")
        error(path, "invalid stack origin");
      if (
        typeof value.active !== "string" ||
        !value.children.some((c) => record(c) && c.id === value.active)
      )
        error(path, "active tab is not a child");
      if (value.axis !== undefined) error(path, "unsupported restore axis");
    }
    for (const [i, child] of value.children.entries())
      visit(child, `${path}.children[${i}]`, depth + 1, value.type === "stack");
  }
  if (!record(layout) || layout.version !== 1) error("layout", "unsupported version");
  if (record(layout)) visit(layout.root, "root", 0);
  if (record(layout) && layout.overlay !== undefined) {
    const o: unknown = layout.overlay;
    // A fold may name the automatic group it made (`@auto:<home>`).
    const text = (v: unknown) =>
      nodeId(v) ||
      (typeof v === "string" && v.startsWith(AUTO_PREFIX) && nodeId(v.slice(AUTO_PREFIX.length)));
    if (!record(o)) error("overlay", "expected overlay");
    else {
      if (!Array.isArray(o.folds) || o.folds.length > cap || !o.folds.every(text))
        error("overlay", "folds must be ids");
      if (
        !record(o.shown) ||
        Object.keys(o.shown).length > cap ||
        !Object.entries(o.shown).every(([k, v]) => text(k) && text(v))
      )
        error("overlay", "shown must map ids to ids");
      if (
        o.hidden !== undefined &&
        (!Array.isArray(o.hidden) ||
          o.hidden.length > cap ||
          !o.hidden.every(text) ||
          new Set(o.hidden).size !== o.hidden.length)
      )
        error("overlay", "hidden must be distinct ids");
      const tucked = new Set<string>();
      if (!Array.isArray(o.tucks) || o.tucks.length > cap)
        error("overlay", "tucks must be records");
      else
        for (const t of o.tucks) {
          if (
            !record(t) ||
            !text(t.pane) ||
            !text(t.home) ||
            t.pane === t.home ||
            !Number.isInteger(t.seq) ||
            (t.seq as number) < 0 ||
            tucked.has(t.pane as string)
          )
            error("overlay", "invalid tuck");
          if (record(t) && typeof t.pane === "string") tucked.add(t.pane);
        }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
