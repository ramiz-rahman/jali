/**
 * The connection measurement's rules, with no network: the run's sizes and limits, decoding Cloudflare's trace and
 * Server-Timing, the latency statistics and the bufferbloat grade. The requests are in http.ts, the run in
 * connection.ts.
 */

/** What a run does, quoted by the pane so its copy can't drift from it. */
export const RUN = {
  /** Transfer sizes per direction, in bytes, smallest first. */
  sizes: [100_000, 1_000_000, 10_000_000, 25_000_000],
  /** A step slower than this stops the sizes from growing. */
  slowStepMs: 1500,
  /** A transfer request gives up after this. */
  timeoutMs: 15_000,
  /** Idle latency samples taken before the transfers. */
  idleSamples: 20,
} as const;

/** The samples a bufferbloat grade needs: idle, and completed pings under load in each direction. */
export const ENOUGH = { idle: 10, loaded: 3 } as const;
export type Trace = Record<string, string>;

export function parseTrace(text: string): Trace {
  const values: Trace = {};
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  if (!values.ip || !values.http)
    throw new Error("The trace did not contain an IP address and HTTP version.");
  return values;
}

export function keyExchange(value: string | undefined): string {
  return value === "X25519MLKEM768"
    ? "X25519MLKEM768 · hybrid post-quantum: X25519 + ML-KEM-768"
    : (value ?? "Not reported");
}

export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];
  return upper === undefined
    ? undefined
    : sorted.length % 2 || lower === undefined
      ? upper
      : (lower + upper) / 2;
}

/** Nearest-rank p90; jitter is mean absolute consecutive difference, not standard deviation. */
export function latencyStats(samples: readonly number[]) {
  if (!samples.length) return undefined;
  const sorted = [...samples].sort((a, b) => a - b);
  const differences = samples.slice(1).map((value, i) => Math.abs(value - (samples[i] ?? value)));
  return {
    median: median(samples) ?? 0,
    min: sorted[0] ?? 0,
    p90: sorted[Math.ceil(sorted.length * 0.9) - 1] ?? 0,
    jitter: differences.length ? differences.reduce((a, b) => a + b, 0) / differences.length : 0,
    count: samples.length,
  };
}

/** Decimal megabits per second; an invalid interval must never become an infinite readout. */
export function mbps(bytes: number, durationMs: number): number | undefined {
  return bytes >= 0 && durationMs > 0 ? (bytes * 8) / (durationMs * 1000) : undefined;
}

export function bufferGrade(addedMs: number): "A" | "B" | "C" | "D" | "E" | "F" {
  if (addedMs < 5) return "A";
  if (addedMs < 30) return "B";
  if (addedMs < 60) return "C";
  if (addedMs < 100) return "D";
  if (addedMs <= 200) return "E";
  return "F";
}

export type TcpStats = Partial<
  Record<"rtt" | "min_rtt" | "rtt_var" | "cwnd" | "retrans" | "lost" | "delivery_rate", number>
>;

export function parseServerTiming(header: string): TcpStats | undefined {
  const description = /(?:^|,)\s*cfL4\s*;\s*desc="([^"]+)"/i.exec(header)?.[1];
  if (!description) return undefined;
  const params = new URLSearchParams(description.replace(/^\?/, ""));
  const stats: TcpStats = {};
  for (const field of [
    "rtt",
    "min_rtt",
    "rtt_var",
    "cwnd",
    "retrans",
    "lost",
    "delivery_rate",
  ] as const) {
    const raw = params.get(field);
    const value = raw === null || raw === "" ? NaN : Number(raw);
    if (Number.isFinite(value) && value >= 0)
      stats[field] = field.includes("rtt") ? value / 1000 : value;
  }
  return Object.keys(stats).length ? stats : undefined;
}

/** What the HTTP/3 experiment saw: already on it, switched to it, stayed on HTTP/2, or nothing to go on. */
export type H3Outcome = "already" | "switched" | "stayed" | "unobserved";

export const H3_TEXT: Record<H3Outcome, string> = {
  already: "Your browser already uses HTTP/3 (QUIC over UDP).",
  switched: "Your browser switched to HTTP/3 (QUIC over UDP).",
  stayed:
    "Stayed on HTTP/2: UDP 443 may be blocked on this network, or the browser hasn't upgraded yet.",
  unobserved:
    "HTTP/3 was not observed. The trace requests may have failed, or this browser has not upgraded yet.",
};

/** Whether the outcome is HTTP/3 in use. */
export const onH3 = (o: H3Outcome) => o === "already" || o === "switched";

export function h3Outcome(before: string | undefined, after: readonly string[]): H3Outcome {
  if (before === "http/3") return "already";
  if (after.includes("http/3")) return "switched";
  if (before === "http/2" && after.includes("http/2")) return "stayed";
  return "unobserved";
}

/** Latency under load in one direction: its median, and what it adds to idle once there are enough samples. */
export interface Loaded {
  median: number | undefined;
  count: number;
  added: number | undefined;
}

/**
 * Bufferbloat from the three series: idle, and pings during download and upload. `worst` is the larger loaded
 * median less idle, graded only when every series has enough samples (ENOUGH).
 */
export function bufferbloat(
  idle: readonly number[],
  down: readonly number[],
  up: readonly number[],
) {
  const base = latencyStats(idle);
  const enoughIdle = base !== undefined && idle.length >= ENOUGH.idle;
  const loaded = (samples: readonly number[]): Loaded => {
    const m = median(samples);
    return {
      median: m,
      count: samples.length,
      added:
        enoughIdle && m !== undefined && samples.length >= ENOUGH.loaded
          ? m - base.median
          : undefined,
    };
  };
  const d = loaded(down);
  const u = loaded(up);
  const worst =
    d.added !== undefined && u.added !== undefined ? Math.max(d.added, u.added) : undefined;
  return { idle: base, down: d, up: u, worst };
}
