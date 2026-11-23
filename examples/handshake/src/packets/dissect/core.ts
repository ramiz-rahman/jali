/**
 * What every dissector shares: the packet being built (its headers, addresses, Info line), the capture-wide session
 * (TCP streams, TLS and HTTP state per direction, QUIC connections), and `Fields`, which makes the field tree with
 * byte positions so each dissector reads as a list of what is in the header and why it matters.
 */
import { Src, Truncated } from "../bytes";
import { TcpTracker } from "../tcp-analysis";
import type { Opened } from "../quic-crypto";
import type { Analysis, Field, Flow, Header, Layer, ProtoId } from "../types";

export interface Out {
  headers: Header[];
  src: string;
  dst: string;
  protocol: string;
  info: string;
  protos: Set<ProtoId>;
  flow?: Flow;
  stream?: { transport: "tcp" | "udp"; index: number };
  analysis: Analysis[];
  plain?: Uint8Array;
}

/** TLS records can run across TCP segments: how much of the current one is still to come, per direction. */
export interface TlsDir {
  pending: number;
  pendingType: number;
  /** After ChangeCipherSpec in TLS 1.2, or ServerHello in 1.3, handshake records are encrypted. */
  encrypted: boolean;
  /** The version the ServerHello chose, shared by both directions. */
  version?: number;
}

/** One QUIC connection, by UDP 4-tuple: who the client is and the connection ID lengths each side chose. */
export interface QuicConn {
  client: string;
  /** The Destination Connection ID of the client's first Initial: the Initial keys come from it. */
  originalDcid: Uint8Array;
  /** The length of the connection IDs each side asked to be addressed by (its SCID), for short headers. */
  cidLen: Record<string, number>;
  /** CRYPTO stream bytes per direction, for a ClientHello split over several Initials. */
  crypto: Record<string, Map<number, { data: Uint8Array; packet: number }>>;
  handshakeDone: Record<string, boolean>;
}

export class Session {
  readonly tcp = new TcpTracker();
  readonly udp = new Map<string, number>();
  readonly tls = new Map<string, TlsDir>();
  readonly httpBody = new Map<string, number>();
  readonly quic = new Map<string, QuicConn>();
  /** The decrypted Initials, by packet number and the packet's offset in the frame (coalesced packets). */
  readonly opened = new Map<string, Opened | string>();
}

export interface Ctx {
  n: number;
  frame: Src;
  out: Out;
  session: Session;
}

/** Builds fields in one layer under one id prefix, each with its bytes found through `s`. */
export class Fields {
  readonly list: Field[];
  readonly s: Src;
  readonly layer: Layer;
  readonly prefix: string;

  constructor(s: Src, layer: Layer, prefix: string, list: Field[] = []) {
    this.s = s;
    this.layer = layer;
    this.prefix = prefix;
    this.list = list;
  }

  private make(
    key: string,
    name: string,
    value: string,
    i: number,
    n: number,
    why?: string,
  ): Field {
    const [offset, length] = n > 0 ? this.s.span(i, n) : [0, 0];
    const field: Field = {
      id: `${this.prefix}.${key}`,
      name,
      value,
      offset,
      length,
      layer: this.layer,
    };
    if (why) field.why = why;
    return field;
  }

  f(key: string, name: string, value: string, i: number, n: number, why?: string): Field {
    const field = this.make(key, name, value, i, n, why);
    this.list.push(field);
    return field;
  }

  /** A field with children; `body` fills them. A child cut short marks the group, not the whole header. */
  group(
    key: string,
    name: string,
    value: string,
    i: number,
    n: number,
    why: string | undefined,
    body: (g: Fields) => void,
    layer: Layer = this.layer,
  ): Field {
    const field = this.make(key, name, value, i, n, why);
    field.layer = layer;
    const children: Field[] = [];
    field.children = children;
    this.list.push(field);
    try {
      body(new Fields(this.s, layer, field.id, children));
    } catch (e) {
      if (!(e instanceof Truncated)) throw e;
      field.warn = true;
      children.push({
        id: `${field.id}.cut`,
        name: "Cut short",
        value: "The bytes end before this does",
        offset: 0,
        length: 0,
        layer,
        warn: true,
      });
    }
    return field;
  }

  /** A value with no bytes of its own: computed (a relative sequence number) or metadata. */
  note(key: string, name: string, value: string, why?: string): Field {
    return this.f(key, name, value, 0, 0, why);
  }

  /** Fields for another layer or a sub-part, sharing this list. */
  as(layer: Layer, s: Src = this.s): Fields {
    return new Fields(s, layer, this.prefix, this.list);
  }
}

/**
 * Start a protocol's header at `i` in `s`, `n` bytes long (adjustable inside `body` with `size`), add it to the
 * packet, and run `body` to fill its fields. A read past the captured bytes marks the header cut short instead of
 * failing the packet. Returns the header, or the error's offset is noted on it.
 */
export function header(
  ctx: Ctx,
  spec: {
    proto: ProtoId;
    short: string;
    name: string;
    layer: Layer;
    s: Src;
    i: number;
    n: number;
    into?: Field[];
  },
  body: (F: Fields, size: (n: number) => void, h: Header) => void,
): Header {
  const { s, i } = spec;
  const [offset, length] = s.span(i, Math.min(spec.n, Math.max(0, s.length - i)));
  const children: Field[] = [];
  const h: Header = {
    id: spec.into ? `${spec.proto}.inner` : spec.proto,
    proto: spec.proto,
    short: spec.short,
    name: spec.name,
    value: "",
    offset,
    length,
    layer: spec.layer,
    extent: Math.max(0, s.length - i),
    children,
  };
  // A second header of the same protocol (IP in ICMP, two QUIC packets in a datagram) gets its own id prefix.
  const taken = new Set((spec.into ?? ctx.out.headers).map((x) => x.id));
  for (let k = 2; taken.has(h.id); k++) h.id = `${spec.proto}${k}`;
  (spec.into ?? ctx.out.headers).push(h);
  if (!spec.into) ctx.out.protos.add(spec.proto);
  const size = (n: number) => {
    const [o, l] = s.span(i, Math.min(n, Math.max(0, s.length - i)));
    h.offset = o;
    h.length = l;
  };
  try {
    body(new Fields(s, spec.layer, h.id, children), size, h);
  } catch (e) {
    if (!(e instanceof Truncated)) throw e;
    h.warn = true;
    children.push({
      id: `${h.id}.cut`,
      name: "Cut short",
      value: "The captured bytes end inside this header",
      offset: 0,
      length: 0,
      layer: spec.layer,
      warn: true,
      why: "The capture's snap length (tcpdump -s) or a damaged packet cut it: what follows can't be read.",
    });
  }
  return h;
}

/** Sets the packet's topmost protocol and Info line. */
export function top(ctx: Ctx, protocol: string, info: string) {
  ctx.out.protocol = protocol;
  ctx.out.info = info;
}

/** Payload nobody here dissects: shown as data so its bytes are still accounted for. */
export function data(ctx: Ctx, s: Src, i: number, layer: Layer, why?: string) {
  const n = s.length - i;
  if (n <= 0) return;
  header(ctx, { proto: "data", short: "Data", name: "Data", layer, s, i, n }, (F, _size, h) => {
    h.value = `${n.toLocaleString("en")} bytes`;
    F.f("bytes", "Data", `${n.toLocaleString("en")} bytes`, i, n, why);
  });
}
