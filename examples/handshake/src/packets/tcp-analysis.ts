/**
 * TCP, per stream, in capture order: which stream a segment belongs to, its sequence and acknowledgement numbers
 * relative to each side's first (as Wireshark shows them), the window after scaling, and Wireshark's analysis flags:
 * retransmission, fast retransmission, duplicate ACK, window update, zero window, and a segment the capture missed.
 */
import type { Analysis } from "./types";

export const TCP = { FIN: 1, SYN: 2, RST: 4, PSH: 8, ACK: 16, URG: 32, ECE: 64, CWR: 128 } as const;

export interface Segment {
  /** The packet number, for "Dup ACK 14#2". */
  n: number;
  src: string;
  dst: string;
  sport: number;
  dport: number;
  seq: number;
  ack: number;
  flags: number;
  window: number;
  /** Payload bytes. */
  len: number;
  /** The window scale option's shift, on a SYN that carries one. */
  wsShift?: number;
}

export interface SegmentResult {
  stream: number;
  /** 0: from the side that sent the first segment seen (the client, when the handshake was captured). */
  dir: 0 | 1;
  relSeq: number;
  relAck: number;
  /** The relative sequence number the next new byte from this side will have. */
  nextRelSeq: number;
  /** The receive window in bytes, scaled when both SYNs said how; undefined scale when the handshake was missed. */
  window: number;
  scale: number | undefined;
  analysis: Analysis[];
  /** The payload is new bytes, in order: safe to hand to TLS or HTTP. */
  inOrder: boolean;
  /** The other side's initial sequence number, for making its numbers in SACK blocks relative. */
  peerBase?: number;
}

interface Side {
  base?: number;
  nextSeq?: number;
  lastAck?: number;
  lastWin?: number;
  lastAckPacket?: number;
  dupAcks: number;
  /** -1: its SYN carried no window scale option, so neither side scales. */
  shift?: number;
}

interface Stream {
  index: number;
  first: string;
  sides: [Side, Side];
}

/** Sequence numbers wrap at 2^32: a is before b when the signed 32-bit difference is negative. */
const before = (a: number, b: number) => ((a - b) | 0) < 0;

export const WHY: Record<Analysis["kind"], string> = {
  retransmission:
    "Bytes this side had already sent: its retransmission timer fired (RTO, at least 200 ms on Linux, 1 s by RFC 6298) or it inferred loss. Each one costs at least a round trip.",
  "fast-retransmission":
    "Resent after duplicate ACKs, before the timer (RFC 5681 §3.2): the receiver's repeated ACKs pointed at the hole, so recovery took one RTT instead of an RTO.",
  "dup-ack":
    "Acknowledges the same byte again: a segment arrived past a hole. Three in a row trigger fast retransmit; the SACK blocks say what did arrive.",
  "window-update":
    "No data, same ACK, a different window: the receiving application read from its buffer, and the receiver tells the sender it may send more.",
  "zero-window":
    "The receive buffer is full: the sender must stop and send window probes. The bottleneck is the receiving application, not the network.",
  "lost-segment":
    "The sequence number jumps past what was seen: a segment before this one never reached the capture point (lost upstream, or dropped by the capture).",
};

export class TcpTracker {
  private streams = new Map<string, Stream>();

  get count() {
    return this.streams.size;
  }

  segment(s: Segment): SegmentResult {
    const a = `${s.src}|${s.sport}`;
    const b = `${s.dst}|${s.dport}`;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    let stream = this.streams.get(key);
    if (!stream) {
      stream = { index: this.streams.size, first: a, sides: [{ dupAcks: 0 }, { dupAcks: 0 }] };
      this.streams.set(key, stream);
    }
    const dir: 0 | 1 = stream.first === a ? 0 : 1;
    const me = stream.sides[dir];
    const peer = stream.sides[dir === 0 ? 1 : 0];
    const syn = (s.flags & TCP.SYN) !== 0;
    const fin = (s.flags & TCP.FIN) !== 0;
    const rst = (s.flags & TCP.RST) !== 0;
    const hasAck = (s.flags & TCP.ACK) !== 0;
    const used = s.len + (syn ? 1 : 0) + (fin ? 1 : 0);

    if (syn) {
      me.base = s.seq;
      me.shift = s.wsShift ?? -1;
    }
    me.base ??= s.seq;

    const analysis: Analysis[] = [];
    const flag = (kind: Analysis["kind"], label: string) =>
      analysis.push({ kind, label, why: WHY[kind] });
    let inOrder = s.len > 0;

    if (me.nextSeq !== undefined && used > 0) {
      // A keep-alive resends the one byte before nextSeq on purpose; it is not a retransmission.
      const keepAlive = s.len <= 1 && !syn && !fin && !rst && s.seq === (me.nextSeq - 1) >>> 0;
      if (before(s.seq, me.nextSeq) && !keepAlive) {
        inOrder = false;
        const fast = peer.dupAcks >= 2 && peer.lastAck === s.seq;
        if (fast) flag("fast-retransmission", "TCP Fast Retransmission");
        else flag("retransmission", "TCP Retransmission");
      } else if (before(me.nextSeq, s.seq) && !syn) {
        inOrder = false;
        flag("lost-segment", "TCP Previous segment not captured");
      }
    }

    const scaled = me.shift !== undefined && peer.shift !== undefined;
    const shift = scaled && me.shift !== -1 && peer.shift !== -1 ? (me.shift ?? 0) : 0;
    // The window on a SYN is never scaled (RFC 7323 §2.2).
    const window = syn ? s.window : s.window * 2 ** shift;

    if (s.window === 0 && !syn && !rst) flag("zero-window", "TCP ZeroWindow");

    const pure = s.len === 0 && !syn && !fin && !rst && hasAck;
    if (pure && me.lastAck === s.ack && analysis.length === 0) {
      // A duplicate only when the peer has sent past the acknowledged byte: an ACK repeated while nothing new came
      // (after this side sent data of its own) is not one.
      const pastHole = peer.nextSeq !== undefined && before(s.ack, peer.nextSeq);
      if (me.lastWin === s.window && s.window !== 0 && pastHole) {
        me.dupAcks += 1;
        flag("dup-ack", `TCP Dup ACK ${me.lastAckPacket ?? "?"}#${me.dupAcks}`);
      } else if (me.lastWin !== s.window && me.lastWin !== undefined) {
        flag("window-update", "TCP Window Update");
      }
    }
    if (hasAck && me.lastAck !== s.ack) {
      me.dupAcks = 0;
      me.lastAckPacket = s.n;
    }
    if (hasAck) me.lastAck = s.ack;
    me.lastWin = s.window;
    const end = (s.seq + used) >>> 0;
    if (me.nextSeq === undefined || before(me.nextSeq, end)) me.nextSeq = end;

    const relSeq = (s.seq - me.base) >>> 0;
    return {
      stream: stream.index,
      dir,
      relSeq,
      relAck: hasAck && peer.base !== undefined ? (s.ack - peer.base) >>> 0 : hasAck ? s.ack : 0,
      nextRelSeq: (me.nextSeq - me.base) >>> 0,
      window,
      scale: scaled ? 2 ** shift : undefined,
      analysis,
      inOrder,
      peerBase: peer.base,
    };
  }
}
