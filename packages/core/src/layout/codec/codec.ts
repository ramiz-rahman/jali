import type { KindRegistry, Layout, LayoutNode, Size } from "../types";
import { validate } from "./validate";
type Packed = Record<string, unknown>;
const packSize = (size: Size) => "px" in size ? [0, size.px] : [1, size.weight];
/** Reshaping only: malformed wire values remain malformed for the single schema in validate. */
function unpackSize(value: unknown): unknown {
  if (!Array.isArray(value) || value.length !== 2) return value;
  return value[0] === 0 ? { px: value[1] } : value[0] === 1 ? { weight: value[1] } : value;
}
function pack(node: LayoutNode): Packed {
  const n: Packed = { i: node.id, t: ({ pane: "p", stack: "s", row: "r", column: "c" })[node.type], s: packSize(node.size) };
  if (node.userSized !== undefined) n.u = node.userSized;
  if (node.base !== undefined) n.b = packSize(node.base);
  if (node.type === "pane") {
    n.r = [node.ref.kind, node.ref.params];
    if (node.linkedTo !== undefined) n.l = node.linkedTo;
    if (node.pinned !== undefined) n.p = node.pinned;
    if (node.follows !== undefined) n.f = node.follows;
    if (node.born !== undefined) n.g = node.born;
    if (node.role !== undefined) n.e = node.role;
    if (node.priority !== undefined) n.y = node.priority;
  } else {
    n.n = node.children.map(pack);
    if (node.type === "stack") { n.a = node.active; if (node.origin) n.o = node.origin; }
  }
  return n;
}
function unpack(value: unknown, depth = 0): unknown {
  if (depth > 128) throw new Error("Tree too deep");
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const n = value as Packed;
  const type = ({ p: "pane", s: "stack", r: "row", c: "column" } as Record<string, string>)[String(n.t)];
  const out: Packed = { id: n.i, type, size: unpackSize(n.s) };
  if (n.u !== undefined) out.userSized = n.u;
  if (n.b !== undefined) out.base = unpackSize(n.b);
  // Old tucked and rail URLs are deliberately unsupported by this spike.
  if (n.k !== undefined || n.c !== undefined || n.d !== undefined) out.legacy = true;
  if (type === "pane") {
    out.ref = Array.isArray(n.r) && n.r.length === 2 ? { kind: n.r[0], params: n.r[1] } : n.r;
    if (n.l !== undefined) out.linkedTo = n.l;
    if (n.p !== undefined) out.pinned = n.p;
    if (n.f !== undefined) out.follows = n.f;
    if (n.g !== undefined) out.born = n.g;
    if (n.e !== undefined) out.role = n.e;
    if (n.y !== undefined) out.priority = n.y;
  } else {
    if (Array.isArray(n.n) && n.n.length > 2048) throw new Error("Tree too large");
    out.children = Array.isArray(n.n) ? n.n.map(c => unpack(c, depth + 1)) : n.n;
    if (type === "stack") { out.active = n.a; if (n.o) out.origin = n.o; }
  }
  return out;
}
export function encode(layout: Layout): string {
  const bytes = new TextEncoder().encode(JSON.stringify([layout.version, pack(layout.root), ...(layout.overlay ? [layout.overlay] : [])]));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `1.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
export function decode(text: string, kinds: KindRegistry): Layout | null {
  try {
    if (typeof text !== "string" || text.length > 1_000_000 || !/^1\.[A-Za-z0-9_-]+$/.test(text)) return null;
    const payload = text.slice(2), binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    if (btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== payload) return null;
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    if (!Array.isArray(data) || (data.length !== 2 && data.length !== 3) || data[0] !== 1) return null;
    const layout = { version: 1, root: unpack(data[1]), ...(data.length === 3 ? { overlay: data[2] } : {}) } as Layout;
    return validate(layout, kinds).ok ? layout : null;
  } catch { return null; }
}
