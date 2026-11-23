/**
 * Walking a packet's field tree: find a field by id, the innermost field over a byte (what hovering a byte in the hex
 * view points at), and each byte's layer (what colours it). Computed once per packet and kept.
 */
import type { Field, Header, Layer, Packet } from "./types";

export interface ByteIndex {
  /** The innermost field with bytes over each byte, by field id. */
  field: (string | undefined)[];
  layer: (Layer | undefined)[];
  byId: Map<string, Field>;
}

const cache = new WeakMap<Packet, ByteIndex>();

export function byteIndex(p: Packet): ByteIndex {
  const known = cache.get(p);
  if (known) return known;
  const n = p.data.length;
  const field: (string | undefined)[] = Array.from({ length: n });
  const span: number[] = Array.from({ length: n }, () => Infinity);
  const layer: (Layer | undefined)[] = Array.from({ length: n });
  const byId = new Map<string, Field>();
  const walk = (f: Field) => {
    byId.set(f.id, f);
    for (let i = f.offset; i < f.offset + f.length && i < n; i++) {
      // The smallest field over a byte is the most specific; a later one of equal size is deeper in the tree.
      if (f.length <= (span[i] ?? Infinity)) {
        span[i] = f.length;
        field[i] = f.id;
        layer[i] = f.layer;
      }
    }
    f.children?.forEach(walk);
  };
  p.headers.forEach(walk);
  const out = { field, layer, byId };
  cache.set(p, out);
  return out;
}

/** The ids from the header down to `id`, for opening a tree to show it. */
export function pathTo(p: Packet, id: string): string[] {
  const path: string[] = [];
  const find = (fields: readonly Field[]): boolean => {
    for (const f of fields) {
      path.push(f.id);
      if (f.id === id || (f.children && find(f.children))) return true;
      path.pop();
    }
    return false;
  };
  find(p.headers);
  return path;
}

/** Headers that carry bytes, outermost first: what the encapsulation is made of. */
export const stackOf = (p: Packet) => p.headers.filter((h) => h.proto !== "frame" && h.extent > 0);

/**
 * The colour a header is drawn in: its layer, or "crypt" when it carries bytes nobody on the path can read (a TLS
 * record's ciphertext). QUIC keeps its transport colour in the stack, because its own header is readable; its
 * encrypted payload shows as crypt in the bytes.
 */
export const displayLayer = (h: Header): Layer =>
  h.proto !== "quic" && h.children?.some((f) => f.layer === "crypt" && f.length > 0)
    ? "crypt"
    : h.layer;

/** The colour of a packet's protocol in the list: its topmost header with bytes. */
export function topLayer(p: Packet): Layer {
  const top = [...p.headers].reverse().find((h) => h.length > 0 && h.proto !== "data");
  return top ? displayLayer(top) : "link";
}
