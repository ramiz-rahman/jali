/** The bundled capture “Tracing the path”. */
import { ethernet, icmpError, ipv4, udp } from "../build";
import { HOSTS, L, R, Tape, v4, type Bundled, type Script } from "./tape";

function tracerouteScript(): Script {
  const tape = new Tape(3000, "pcap-ns");
  const ids = new Map<string, number>();
  const target = HOSTS.quic;
  const hops: ({ ip: string; rtt: number; ttl: number } | null)[] = [
    { ip: R.ip, rtt: 1.8, ttl: 64 },
    { ip: "198.51.100.1", rtt: 8.9, ttl: 254 },
    { ip: "198.51.100.65", rtt: 11.4, ttl: 253 },
    null,
    { ip: "203.0.113.9", rtt: 21.7, ttl: 251 },
  ];
  let ms = 0;
  for (let ttl = 1; ttl <= 6; ttl++) {
    // Classic traceroute: UDP to port 33434 and up, one port per probe, so a reply's quote says which probe it was.
    const seg = udp(L.ip, target, 51034, 33433 + ttl, new Uint8Array(24));
    const packet = ipv4(
      { src: L.ip, dst: target, proto: 17, ttl, id: 0x6c00 + ttl, df: false },
      seg,
    );
    tape.add(ms, ethernet(R.mac, L.mac, 0x0800, packet), `ttl-${ttl}`);
    // The probe as the replying router saw it: TTL 1 on arrival (its header checksum recomputed on the way).
    const quoted = ipv4(
      { src: L.ip, dst: target, proto: 17, ttl: 1, id: 0x6c00 + ttl, df: false },
      seg,
    );
    const hop = hops[ttl - 1];
    if (ttl === 6) {
      // The target itself: nothing listens on the port, so its kernel answers port unreachable. Linux starts at 64.
      tape.add(
        ms + 25.3,
        v4("internet", target, L.ip, 1, icmpError(3, 3, quoted), ids, 64 - 5),
        "final-reply",
      );
    } else if (hop) {
      tape.add(
        ms + hop.rtt,
        v4("internet", hop.ip, L.ip, 1, icmpError(11, 0, quoted), ids, hop.ttl),
        `exceeded-${ttl}`,
      );
    }
    // traceroute waits up to 5 s for a reply before it prints * and moves on.
    ms += hop === null ? 5000 : (hop?.rtt ?? 25) + 0.4;
  }
  return tape.script;
}

export const traceroute: Bundled = {
  title: "Tracing the path",
  summary:
    "traceroute to 192.0.2.80, one probe per hop (traceroute -q 1). UDP probes with TTL 1, 2, 3…, each answered with ICMP Time Exceeded by the router where its TTL ran out. Hop 4 never answers, so traceroute waits 5 s and prints * * *. The target answers Port Unreachable, which is how traceroute knows it has arrived.",
  build: tracerouteScript,
};
