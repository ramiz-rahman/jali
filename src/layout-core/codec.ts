import type { KindRegistry, Layout, LayoutNode, Size, TuckOrigin } from "./types";
import { validate } from "./validate";
import { migrateCollapsed } from "./tuck";

type Packed = Record<string, unknown>;
const packSize = (size: Size) => "px" in size ? [0, size.px] : [1, size.weight];
function unpackSize(value: unknown): Size {
  if (!Array.isArray(value) || value.length !== 2 || (value[0] !== 0 && value[0] !== 1)) throw new Error("Invalid size");
  return value[0] === 0 ? { px: value[1] } : { weight: value[1] };
}
/** tuckedFrom packs as k: [parent, axis 0|1, index, beside, side 0|1, size, home, userSized|null, extent|null, resized|null?, seq?, order?]. */
function packTuck(t: TuckOrigin): unknown[] {
  const out: unknown[] = [t.parent, t.axis === "row" ? 0 : 1, t.index, t.beside, t.side === "after" ? 1 : 0, packSize(t.size), t.home, t.userSized ?? null, t.extent ?? null];
  const resized = t.resized ? t.resized.map(([id, a, b]) => [id, packSize(a), packSize(b)]) : null;
  if (t.seq !== undefined) out.push(resized, t.seq, t.order ?? null);
  else if (resized) out.push(resized);
  return out;
}
function unpackTuck(k: unknown): TuckOrigin {
  if (!Array.isArray(k) || (k.length !== 9 && k.length !== 10 && k.length !== 12)) throw new Error("Invalid tuck origin");
  const t: TuckOrigin = { parent: k[0], axis: k[1] === 0 ? "row" : "column", index: k[2], beside: k[3], side: k[4] === 1 ? "after" : "before", size: unpackSize(k[5]), home: k[6] };
  if (k[1] !== 0 && k[1] !== 1 || k[4] !== 0 && k[4] !== 1) throw new Error("Invalid tuck origin");
  if (k[7] !== null) t.userSized = k[7];
  if (k[8] !== null) t.extent = k[8];
  if (k.length >= 10 && k[9] !== null) {
    if (!Array.isArray(k[9]) || k[9].length > 2048) throw new Error("Invalid tuck sizes");
    t.resized = k[9].map((r: unknown) => { if (!Array.isArray(r) || r.length !== 3) throw new Error("Invalid tuck sizes"); return [r[0], unpackSize(r[1]), unpackSize(r[2])]; });
  }
  if (k.length === 12) {
    if (!Number.isInteger(k[10]) || k[10] < 0) throw new Error("Invalid tuck sequence");
    t.seq = k[10];
    if (k[11] !== null) {
      if (!Array.isArray(k[11]) || k[11].length > 2048 || !k[11].every((v: unknown) => typeof v === "string")) throw new Error("Invalid tuck order");
      t.order = k[11];
    }
  }
  return t;
}
function pack(node: LayoutNode): Packed {
  const base: Packed = { i: node.id, t: node.type === "pane" ? "p" : node.type === "stack" ? "s" : node.type === "row" ? "r" : "c", s: "px" in node.size ? [0, node.size.px] : [1, node.size.weight] };
  if (node.userSized !== undefined) base.u = node.userSized;
  if (node.type === "pane") {
    base.r = [node.ref.kind, node.ref.params];
    if (node.linkedTo !== undefined) base.l = node.linkedTo;
    if (node.pinned !== undefined) base.p = node.pinned;
    if (node.tuckedFrom !== undefined) base.k = packTuck(node.tuckedFrom);
  } else {
    base.n = node.children.map(pack);
    if (node.type === "stack") { base.a = node.active; base.o = node.origin; if (node.axis !== undefined) base.d = node.axis; }
  }
  return base;
}
function unpack(value: unknown, depth = 0): unknown {
  if (depth > 128 || typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid node");
  const n = value as Packed;
  if (!Array.isArray(n.s) || n.s.length !== 2 || (n.s[0] !== 0 && n.s[0] !== 1)) throw new Error("Invalid size");
  const type = ({ p: "pane", s: "stack", r: "row", c: "column" } as Record<string, string>)[String(n.t)];
  if (!type) throw new Error("Invalid type");
  const base: Packed = { id: n.i, type, size: n.s[0] === 0 ? { px: n.s[1] } : { weight: n.s[1] } };
  if (n.u !== undefined) base.userSized = n.u;
  if (type === "pane") {
    if (!Array.isArray(n.r) || n.r.length !== 2) throw new Error("Invalid reference");
    base.ref = { kind: n.r[0], params: n.r[1] };
    if (n.l !== undefined) base.linkedTo = n.l;
    if (n.p !== undefined) base.pinned = n.p;
    // Rail-era links: `c` (collapsed) is migrated to a tuck after decoding.
    if (n.c !== undefined) base.collapsed = n.c;
    if (n.k !== undefined) base.tuckedFrom = unpackTuck(n.k);
  } else {
    if (!Array.isArray(n.n) || n.n.length > 2048) throw new Error("Invalid children");
    base.children = n.n.map(c => unpack(c, depth + 1));
    if (type === "stack") { base.active = n.a; base.origin = n.o; if (n.d !== undefined) base.axis = n.d; }
  }
  return base;
}
export function encode(layout: Layout): string {
  // Recorded folds ride along, so a reload or Back shows the same arrangement before it is refitted for the screen.
  const fold = layout.fold ? [[layout.fold.order, ...(layout.fold.active ? [layout.fold.active] : [])]] : [];
  const bytes = new TextEncoder().encode(JSON.stringify([layout.version, pack(layout.root), ...fold]));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `1.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
export function decode(text: string, kinds: KindRegistry): Layout | null {
  try {
    if (typeof text !== "string" || text.length > 1_000_000 || !/^1\.[A-Za-z0-9_-]+$/.test(text)) return null;
    const payload = text.slice(2);
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    // Reject noncanonical base64 trailing bits as well as malformed UTF-8 and JSON.
    if (btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== payload) return null;
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    if (!Array.isArray(data) || (data.length !== 2 && data.length !== 3) || data[0] !== 1) return null;
    const layout = { version: 1, root: unpack(data[1]) } as Layout;
    if (data.length === 3) {
      const fold = data[2];
      if (!Array.isArray(fold) || fold.length < 1 || fold.length > 2) return null;
      layout.fold = { order: fold[0], ...(fold.length === 2 ? { active: fold[1] } : {}) };
    }
    if (!validate(layout, kinds).ok) return null;
    const migrated = migrateCollapsed(layout);
    return migrated === layout || validate(migrated, kinds).ok ? migrated : null;
  } catch { return null; }
}
