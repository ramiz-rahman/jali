/** TCP analysis, segment by segment: relative numbers, window scaling and each of Wireshark's flags. */
import { TCP, TcpTracker, type Segment } from "./tcp-analysis";

const C = { src: "10.0.0.2", sport: 50000, dst: "10.0.0.9", dport: 80 };
const S = { src: "10.0.0.9", sport: 80, dst: "10.0.0.2", dport: 50000 };
const ISN_C = 4_294_967_000; // wraps past 2^32 within the first kilobyte
const ISN_S = 77_000;

/** A tracker that has seen the handshake: client WS 7, server WS 7. */
function opened() {
  const t = new TcpTracker();
  let n = 0;
  const seg = (side: typeof C, o: Omit<Segment, "n" | "src" | "dst" | "sport" | "dport">) =>
    t.segment({ n: ++n, ...side, ...o });
  seg(C, { seq: ISN_C, ack: 0, flags: TCP.SYN, window: 65535, len: 0, wsShift: 7 });
  seg(S, {
    seq: ISN_S,
    ack: (ISN_C + 1) >>> 0,
    flags: TCP.SYN | TCP.ACK,
    window: 65160,
    len: 0,
    wsShift: 7,
  });
  seg(C, { seq: (ISN_C + 1) >>> 0, ack: ISN_S + 1, flags: TCP.ACK, window: 2052, len: 0 });
  return { t, seg };
}

describe("TcpTracker", () => {
  it("makes sequence numbers relative, across the 2^32 wrap", () => {
    const { seg } = opened();
    const r = seg(C, {
      seq: (ISN_C + 1) >>> 0,
      ack: ISN_S + 1,
      flags: TCP.ACK | TCP.PSH,
      window: 2052,
      len: 500,
    });
    expect(r).toMatchObject({
      stream: 0,
      dir: 0,
      relSeq: 1,
      relAck: 1,
      nextRelSeq: 501,
      inOrder: true,
    });
    const next = seg(C, {
      seq: (ISN_C + 501) >>> 0,
      ack: ISN_S + 1,
      flags: TCP.ACK,
      window: 2052,
      len: 500,
    });
    expect(next.relSeq).toBe(501);
    expect(next.analysis).toEqual([]);
  });

  it("scales the window only when both SYNs carried the option, and never on a SYN", () => {
    const { seg } = opened();
    expect(
      seg(S, { seq: ISN_S + 1, ack: (ISN_C + 1) >>> 0, flags: TCP.ACK, window: 502, len: 0 }),
    ).toMatchObject({ window: 64256, scale: 128 });
    const t = new TcpTracker();
    t.segment({ n: 1, ...C, seq: 1, ack: 0, flags: TCP.SYN, window: 100, len: 0, wsShift: 7 });
    t.segment({ n: 2, ...S, seq: 1, ack: 2, flags: TCP.SYN | TCP.ACK, window: 100, len: 0 });
    expect(
      t.segment({ n: 3, ...C, seq: 2, ack: 2, flags: TCP.ACK, window: 100, len: 0 }),
    ).toMatchObject({ window: 100, scale: 1 });
  });

  it("does not know the scale when the handshake was missed", () => {
    const t = new TcpTracker();
    expect(
      t.segment({ n: 1, ...C, seq: 5000, ack: 9000, flags: TCP.ACK, window: 300, len: 10 }),
    ).toMatchObject({ relSeq: 0, scale: undefined, window: 300 });
  });

  it("flags a gap, duplicate ACKs, a fast retransmission and a window update", () => {
    const { seg } = opened();
    const data = (k: number, o: Partial<Segment> = {}) =>
      seg(S, {
        seq: ISN_S + 1 + k * 1000,
        ack: (ISN_C + 1) >>> 0,
        flags: TCP.ACK,
        window: 502,
        len: 1000,
        ...o,
      });
    const ack = (upTo: number, window = 2052) =>
      seg(C, { seq: (ISN_C + 1) >>> 0, ack: ISN_S + 1 + upTo, flags: TCP.ACK, window, len: 0 });
    data(0);
    ack(1000);
    // Segment 1 is lost: segment 2 shows a gap.
    expect(data(2).analysis.map((a) => a.kind)).toEqual(["lost-segment"]);
    expect(ack(1000).analysis.map((a) => a.label)).toEqual(["TCP Dup ACK 5#1"]);
    data(3);
    expect(ack(1000).analysis.map((a) => a.label)).toEqual(["TCP Dup ACK 5#2"]);
    const resent = data(1);
    expect(resent.analysis.map((a) => a.kind)).toEqual(["fast-retransmission"]);
    expect(resent.inOrder).toBe(false);
    expect(ack(4000).analysis).toEqual([]);
    expect(ack(4000, 4000).analysis.map((a) => a.kind)).toEqual(["window-update"]);
  });

  it("calls a resend without duplicate ACKs a plain retransmission", () => {
    const { seg } = opened();
    seg(C, {
      seq: (ISN_C + 1) >>> 0,
      ack: ISN_S + 1,
      flags: TCP.ACK | TCP.PSH,
      window: 2052,
      len: 100,
    });
    const again = seg(C, {
      seq: (ISN_C + 1) >>> 0,
      ack: ISN_S + 1,
      flags: TCP.ACK | TCP.PSH,
      window: 2052,
      len: 100,
    });
    expect(again.analysis.map((a) => a.kind)).toEqual(["retransmission"]);
  });

  it("flags a zero window, and doesn't call a repeated ACK a duplicate when nothing new arrived", () => {
    const { seg } = opened();
    seg(C, {
      seq: (ISN_C + 1) >>> 0,
      ack: ISN_S + 1,
      flags: TCP.ACK | TCP.PSH,
      window: 2052,
      len: 100,
    });
    expect(
      seg(C, { seq: (ISN_C + 101) >>> 0, ack: ISN_S + 1, flags: TCP.ACK, window: 2052, len: 0 })
        .analysis,
    ).toEqual([]);
    expect(
      seg(C, {
        seq: (ISN_C + 101) >>> 0,
        ack: ISN_S + 1,
        flags: TCP.ACK,
        window: 0,
        len: 0,
      }).analysis.map((a) => a.kind),
    ).toContain("zero-window");
  });

  it("does not take a keep-alive for a retransmission", () => {
    const { seg } = opened();
    expect(
      seg(C, { seq: ISN_C, ack: ISN_S + 1, flags: TCP.ACK, window: 2052, len: 1 }).analysis,
    ).toEqual([]);
  });

  it("numbers streams in order of first appearance", () => {
    const t = new TcpTracker();
    t.segment({ n: 1, ...C, seq: 1, ack: 0, flags: TCP.SYN, window: 1, len: 0 });
    expect(
      t.segment({ n: 2, ...C, sport: 50001, seq: 1, ack: 0, flags: TCP.SYN, window: 1, len: 0 })
        .stream,
    ).toBe(1);
    expect(
      t.segment({ n: 3, ...S, seq: 1, ack: 2, flags: TCP.SYN | TCP.ACK, window: 1, len: 0 }),
    ).toMatchObject({ stream: 0, dir: 1 });
  });
});
