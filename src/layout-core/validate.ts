import type { KindRegistry, Layout } from "./types";

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
export function validate(layout: Layout, kinds: KindRegistry): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>(), seen = new Set<object>();
  let count = 0;
  const error = (path: string, message: string) => errors.push(`${path}: ${message}`);
  function visit(value: unknown, path: string, depth: number, inStack = false): void {
    if (++count > 2048 || depth > 128) { error(path, "tree is too large or deep"); return; }
    if (!record(value)) { error(path, "expected a node"); return; }
    if (seen.has(value)) { error(path, "cyclic or shared node"); return; }
    seen.add(value);
    if (typeof value.id !== "string" || !value.id.length) error(path, "id must be a non-empty string");
    else if (ids.has(value.id)) error(path, `duplicate id ${value.id}`); else ids.add(value.id);
    const size = value.size;
    if (!record(size) || Object.keys(size).length !== 1 || !(positive(size.px) || positive(size.weight))) error(path, "size must have exactly one finite positive px or weight");
    if (value.userSized !== undefined && typeof value.userSized !== "boolean") error(path, "userSized must be boolean");
    if (value.type === "pane") {
      const ref = value.ref;
      if (!record(ref) || typeof ref.kind !== "string" || !Object.hasOwn(kinds, ref.kind)) error(path, "unknown pane kind");
      if (!record(ref) || !record(ref.params) || !Object.values(ref.params).every(p => typeof p === "string" || typeof p === "number" && Number.isFinite(p))) error(path, "invalid object params");
      if (value.linkedTo !== undefined && (typeof value.linkedTo !== "string" || !value.linkedTo.length)) error(path, "invalid linkedTo");
      // `collapsed` is the rail era's flag: still accepted so old links decode (and migrate to a tuck).
      for (const flag of ["pinned", "collapsed"]) if (value[flag] !== undefined && typeof value[flag] !== "boolean") error(path, `${flag} must be boolean`);
      if (value.tuckedFrom !== undefined) {
        const t = value.tuckedFrom;
        const sizeOk = (s: unknown) => record(s) && Object.keys(s).length === 1 && (positive(s.px) || positive(s.weight));
        const id = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 512;
        if (!record(t) || !id(t.parent) || !id(t.beside) || !id(t.home) || (t.axis !== "row" && t.axis !== "column") || (t.side !== "before" && t.side !== "after")
          || !Number.isInteger(t.index) || (t.index as number) < 0 || !sizeOk(t.size) || (t.userSized !== undefined && typeof t.userSized !== "boolean")
          || (t.extent !== undefined && !(typeof t.extent === "number" && Number.isFinite(t.extent) && t.extent >= 0))
          || (t.resized !== undefined && !(Array.isArray(t.resized) && t.resized.every(r => Array.isArray(r) && r.length === 3 && id(r[0]) && sizeOk(r[1]) && sizeOk(r[2])))))
          error(path, "invalid tuckedFrom");
      }
      return;
    }
    if (inStack) { error(path, "stacks may contain only panes"); return; }
    if (!["row", "column", "stack"].includes(value.type as string)) { error(path, "unknown node type"); return; }
    if (!Array.isArray(value.children) || !value.children.length) { error(path, "children must be non-empty"); return; }
    if (value.type === "stack") {
      if (value.origin !== "auto" && value.origin !== "user" && value.origin !== "tuck") error(path, "invalid stack origin");
      if (typeof value.active !== "string" || !value.children.some(c => record(c) && c.id === value.active)) error(path, "active tab is not a child");
      if (value.axis !== undefined && value.axis !== "row" && value.axis !== "column") error(path, "invalid restore axis");
    }
    for (const [i, child] of value.children.entries()) visit(child, `${path}.children[${i}]`, depth + 1, value.type === "stack");
  }
  if (!record(layout) || layout.version !== 1) error("layout", "unsupported version");
  if (record(layout)) visit(layout.root, "root", 0);
  if (record(layout) && layout.fold !== undefined) {
    // Fold records are hints: unknown ids are skipped when replayed, so only their shape is checked.
    const fold: unknown = layout.fold;
    const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length < 512;
    if (!record(fold) || !Array.isArray(fold.order) || fold.order.length > 2048 || !fold.order.every(text)) error("fold", "order must be a list of ids");
    else if (fold.active !== undefined && (!record(fold.active) || Object.keys(fold.active).length > 2048 || !Object.entries(fold.active).every(([k, v]) => text(k) && text(v)))) error("fold", "active must map ids to ids");
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
