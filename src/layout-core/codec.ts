import type { KindRegistry, Layout, LayoutNode } from "./types";
import { validate } from "./validate";

type Packed = Record<string, unknown>;
function pack(node: LayoutNode): Packed {
  const base: Packed = { i: node.id, t: node.type === "pane" ? "p" : node.type === "stack" ? "s" : node.type === "row" ? "r" : "c", s: "px" in node.size ? [0, node.size.px] : [1, node.size.weight] };
  if (node.userSized !== undefined) base.u = node.userSized;
  if (node.type === "pane") {
    base.r = [node.ref.kind, node.ref.params];
    if (node.linkedTo !== undefined) base.l = node.linkedTo;
    if (node.pinned !== undefined) base.p = node.pinned;
    if (node.collapsed !== undefined) base.c = node.collapsed;
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
    if (n.c !== undefined) base.collapsed = n.c;
  } else {
    if (!Array.isArray(n.n) || n.n.length > 2048) throw new Error("Invalid children");
    base.children = n.n.map(c => unpack(c, depth + 1));
    if (type === "stack") { base.active = n.a; base.origin = n.o; if (n.d !== undefined) base.axis = n.d; }
  }
  return base;
}
export function encode(layout: Layout): string {
  const bytes = new TextEncoder().encode(JSON.stringify([layout.version, pack(layout.root)]));
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
    if (!Array.isArray(data) || data.length !== 2 || data[0] !== 1) return null;
    const layout = { version: 1, root: unpack(data[1]) } as Layout;
    return validate(layout, kinds).ok ? layout : null;
  } catch { return null; }
}
