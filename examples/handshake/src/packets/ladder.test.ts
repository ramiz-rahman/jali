/** The ladder: which conversation it draws, and how many round trips the request waited for. */
import { ladderOf } from "./ladder";
import { ready } from "./testing";

describe("ladderOf", () => {
  it("counts TCP and TLS 1.3 as two round trips before the request", async () => {
    const m = ladderOf(await ready("tls13"));
    expect(m.phases.map((p) => p.label)).toEqual(["TCP handshake", "TLS 1.3 handshake"]);
    expect(m.rtt).toBeCloseTo(0.025, 3);
    expect(m.arrows.find((a) => a.n === m.request)?.label).toBe("Encrypted");
    expect(m.summary).toMatch(/after 2 round trips/);
    expect(m.arrows.slice(0, 4).map((a) => a.label)).toEqual([
      "SYN",
      "SYN, ACK",
      "ACK",
      "ClientHello",
    ]);
  });

  it("counts QUIC as one", async () => {
    const m = ladderOf(await ready("quic-h3"));
    expect(m.phases.map((p) => p.label)).toEqual(["QUIC + TLS 1.3 handshake"]);
    expect(m.summary).toMatch(/after 1 round trip /);
    expect(m.arrows[0]?.label).toBe("Initial · ClientHello");
    expect(m.arrows.find((a) => a.n === m.request)?.label).toBe("1-RTT");
  });

  it("draws plain HTTP's request after the TCP handshake, with the loss flagged", async () => {
    const m = ladderOf(await ready("tcp-lifecycle"));
    expect(m.phases).toHaveLength(1);
    expect(m.arrows.find((a) => a.n === m.request)?.label).toMatch(/^GET /);
    expect(m.arrows.filter((a) => a.flagged).map((a) => a.label)).toContain("Fast Retransmission");
  });

  it("shows a capture with no stream as this host and the network", async () => {
    const m = ladderOf(await ready("traceroute"));
    expect(m.left).toBe("192.168.1.23");
    expect(m.right).toBe("The network");
    expect(m.arrows).toHaveLength(11);
    expect(m.arrows[1]).toMatchObject({ out: false, label: "Time Exceeded", peer: "192.168.1.1" });
    expect(m.omitted).toBe(0);
  });
});
