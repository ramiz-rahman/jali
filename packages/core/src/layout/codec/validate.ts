import type { KindRegistry, Layout, ObjectRef } from "../types";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
export function validate(
  layout: Layout,
  kinds: KindRegistry,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>(),
    seen = new Set<object>();
  let count = 0;
  const error = (path: string, message: string) => errors.push(`${path}: ${message}`);
  function visit(value: unknown, path: string, depth: number, inStack = false): void {
    if (++count > 2048 || depth > 128) {
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
    if (typeof value.id !== "string" || !value.id.length)
      error(path, "id must be a non-empty string");
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
      else if (typeof ref.kind === "string" && Object.hasOwn(kinds, ref.kind)) {
        const problem = kinds[ref.kind]!.checkParams?.(ref.params as ObjectRef["params"]);
        if (problem) error(path, `invalid params for ${ref.kind}: ${problem}`);
      }
      if (
        value.linkedTo !== undefined &&
        (typeof value.linkedTo !== "string" || !value.linkedTo.length)
      )
        error(path, "invalid linkedTo");
      if (value.kept !== undefined && typeof value.kept !== "boolean")
        error(path, "kept must be boolean");
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
    const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 512;
    if (!record(o)) error("overlay", "expected overlay");
    else {
      if (!Array.isArray(o.folds) || o.folds.length > 2048 || !o.folds.every(text))
        error("overlay", "folds must be ids");
      if (
        !record(o.shown) ||
        Object.keys(o.shown).length > 2048 ||
        !Object.entries(o.shown).every(([k, v]) => text(k) && text(v))
      )
        error("overlay", "shown must map ids to ids");
      if (
        o.hidden !== undefined &&
        (!Array.isArray(o.hidden) ||
          o.hidden.length > 2048 ||
          !o.hidden.every(text) ||
          new Set(o.hidden).size !== o.hidden.length)
      )
        error("overlay", "hidden must be distinct ids");
      const tucked = new Set<string>();
      if (!Array.isArray(o.tucks) || o.tucks.length > 2048)
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
