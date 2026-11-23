/** Recorded Cloudflare strings and deterministic statistics: these tests never request the network. */
import {
  bufferbloat,
  bufferGrade,
  h3Outcome,
  keyExchange,
  latencyStats,
  mbps,
  median,
  parseServerTiming,
  parseTrace,
} from "./connection-model";
import { retryTime } from "./http";

const TRACE = `fl=35f625
ip=203.0.113.7
ts=1795388862.303
visit_scheme=https
uag=Mozilla/5.0
colo=DAC
http=http/2
loc=BD
tls=TLSv1.3
sni=plaintext
warp=off
gateway=off
kex=X25519MLKEM768
`;
const SERVER_TIMING =
  'cfSpeedEdge;dur=2, cfSpeedWorker;dur=18, cfL4;desc="?proto=TCP&rtt=5737&min_rtt=4847&rtt_var=2454&sent=4&recv=7&lost=0&retrans=0&sent_bytes=2842&recv_bytes=513&delivery_rate=589230&cwnd=52&unsent_bytes=0&cid=af6dce6c49ff59a8&ts=32&x=0"';

describe("Cloudflare decoding", () => {
  it("reads trace fields without destroying equals signs in values", () => {
    expect(parseTrace(TRACE)).toMatchObject({
      colo: "DAC",
      http: "http/2",
      loc: "BD",
      warp: "off",
      kex: "X25519MLKEM768",
    });
    expect(parseTrace(`${TRACE}extra=a=b\r\n`).extra).toBe("a=b");
    expect(keyExchange("X25519MLKEM768")).toContain("hybrid post-quantum");
    expect(keyExchange("X25519")).toBe("X25519");
  });
  it("rejects HTML and incomplete traces", () => {
    expect(() => parseTrace("<html>unavailable</html>")).toThrow();
    expect(() => parseTrace("ip=203.0.113.7")).toThrow();
  });
  it("converts server microseconds, retaining counters and delivery bytes/s", () => {
    expect(parseServerTiming(SERVER_TIMING)).toEqual({
      rtt: 5.737,
      min_rtt: 4.847,
      rtt_var: 2.454,
      cwnd: 52,
      retrans: 0,
      lost: 0,
      delivery_rate: 589230,
    });
    expect(parseServerTiming('cfL4;desc="?rtt=nope&cwnd=0&lost=-1"')).toEqual({ cwnd: 0 });
    expect(parseServerTiming("cfSpeedWorker;dur=18")).toBeUndefined();
  });
});

describe("measurement mathematics", () => {
  it("uses nearest-rank p90 and consecutive mean absolute difference", () => {
    expect(latencyStats([10, 20, 10, 40])).toEqual({
      median: 15,
      min: 10,
      p90: 40,
      jitter: 50 / 3,
      count: 4,
    });
    expect(latencyStats(Array.from({ length: 20 }, (_, i) => i + 1))?.p90).toBe(18);
    expect(median([50, 1, 3])).toBe(3);
    expect(latencyStats([])).toBeUndefined();
    expect(latencyStats([5])?.jitter).toBe(0);
  });
  it("uses decimal Mbps and rejects a zero measurement interval", () => {
    expect(mbps(1_000_000, 1000)).toBe(8);
    expect(mbps(1_000_000, 0)).toBeUndefined();
  });
  it.each([
    [-2, "A"],
    [4.99, "A"],
    [5, "B"],
    [30, "C"],
    [60, "D"],
    [100, "E"],
    [200, "E"],
    [200.01, "F"],
  ] as const)("grades %s ms as %s", (value, grade) => {
    expect(bufferGrade(value)).toBe(grade);
  });
});

describe("honest HTTP/3 outcomes", () => {
  it("requires an observed trace using HTTP/3", () => {
    expect(h3Outcome("http/2", ["http/2", "http/3"])).toBe("switched");
    expect(h3Outcome("http/3", ["http/3"])).toBe("already");
    expect(h3Outcome("http/2", ["http/2"])).toBe("stayed");
    expect(h3Outcome(undefined, [])).toBe("unobserved");
    expect(h3Outcome("http/1.1", ["http/1.1"])).toBe("unobserved");
  });
  it("decodes both forms of Retry-After", () => {
    expect(retryTime("60", 1000)).toBe(61_000);
    expect(retryTime("Wed, 21 Oct 2015 07:28:00 GMT")).toBe(Date.parse("2015-10-21T07:28:00Z"));
    expect(retryTime("unknown")).toBeUndefined();
  });
});

describe("bufferbloat", () => {
  const idle = Array.from({ length: 10 }, () => 20);
  it("grades the worse direction once every series has enough samples", () => {
    const b = bufferbloat(idle, [60, 60, 60], [30, 30, 30]);
    expect(b.down.added).toBe(40);
    expect(b.up.added).toBe(10);
    expect(b.worst).toBe(40);
  });
  it("does not grade on too few samples", () => {
    const b = bufferbloat(idle.slice(0, 9), [60, 60, 60], [30, 30, 30]);
    expect(b.down.added).toBeUndefined();
    expect(b.worst).toBeUndefined();
    expect(bufferbloat(idle, [60, 60], [30, 30, 30]).worst).toBeUndefined();
  });
});
