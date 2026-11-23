/**
 * The connection measurement: Cloudflare's trace, read when the pane opens, and a run the person starts (idle
 * latency, download and upload with latency under load, then the HTTP/3 experiment). It lives for the session, in
 * `connectionStore`, so every Connection pane shows the same run and a lesson can read it.
 */
import { createStore, IDLE, LOADING, type Remote } from "#src/store.ts";
import {
  h3Outcome,
  H3_TEXT,
  mbps,
  onH3,
  parseServerTiming,
  parseTrace,
  RUN,
  type H3Outcome,
  type TcpStats,
  type Trace,
} from "./connection-model";
import { delay, failure, fresh, request, SPEED } from "./http";

/** The stages of a run, in order. */
export type Stage = "idle" | "download" | "upload" | "h3";

export const STAGE_TITLE: Record<Stage, string> = {
  idle: `Idle latency · ${RUN.idleSamples} requests`,
  download: "Download + loaded latency",
  upload: "Upload + loaded latency",
  h3: "HTTP/3 upgrade experiment",
};

export type TransferStep = {
  id: string;
  direction: "download" | "upload";
  bytes: number;
  ms: number;
  rate: number;
  ttfb?: number;
  transfer?: number;
  protocol?: string;
};

export type RunLog = {
  id: string;
  text: string;
  time: string;
  kind: "sys" | "ok" | "warn" | "err";
  /** The stage it was written in, so a pane can show one stage's lines. */
  stage?: Stage;
};

export type ConnectionSession = {
  status: "idle" | "running" | "complete" | "cancelled";
  /** The stage running now. */
  stage?: Stage;
  trace: Remote<Trace>;
  idle: number[];
  downloadLatency: number[];
  uploadLatency: number[];
  steps: TransferStep[];
  tcp?: TcpStats;
  log: RunLog[];
  errors: string[];
  h3?: H3Outcome;
  finishedAt?: string;
};

const EMPTY_RUN = {
  stage: undefined,
  idle: [],
  downloadLatency: [],
  uploadLatency: [],
  steps: [],
  tcp: undefined,
  log: [],
  errors: [],
  h3: undefined,
  finishedAt: undefined,
} satisfies Partial<ConnectionSession>;

export const connectionStore = createStore<ConnectionSession>({
  status: "idle",
  trace: IDLE,
  ...EMPTY_RUN,
});

const session = () => connectionStore.get();
const publish = (patch: Partial<ConnectionSession>) =>
  connectionStore.update((s) => ({ ...s, ...patch }));

/** What the run is doing, in a few words. */
export function phaseOf(s: ConnectionSession): string {
  switch (s.status) {
    case "idle":
      return "Ready";
    case "running":
      return s.stage ? STAGE_TITLE[s.stage] : "Starting";
    case "complete":
      return s.errors.length ? "Finished with unavailable stages" : "Complete";
    case "cancelled":
      return "Cancelled · partial results retained";
  }
}

function log(text: string, kind: RunLog["kind"] = "sys") {
  const { log: lines, stage } = session();
  publish({
    log: [
      ...lines,
      { id: String(lines.length), text, kind, stage, time: new Date().toLocaleTimeString() },
    ],
  });
}

let tracePending: Promise<void> | undefined;

export function loadTrace(): Promise<void> {
  if (tracePending) return tracePending;
  publish({ trace: LOADING });
  tracePending = request(fresh(`${SPEED}/cdn-cgi/trace`), new AbortController().signal)
    .then((result) => publish({ trace: { status: "ready", data: parseTrace(result.text) } }))
    .catch((error: unknown) => publish({ trace: { status: "failed", error: failure(error) } }))
    .finally(() => {
      tracePending = undefined;
    });
  return tracePending;
}

let controller: AbortController | undefined;

export function cancelConnection() {
  controller?.abort();
}

async function ping(signal: AbortSignal) {
  const result = await request(fresh(`${SPEED}/__down?bytes=0`), signal, {}, false, 8_000);
  const tcp = parseServerTiming(result.serverTiming);
  if (tcp) publish({ tcp });
  return result.elapsed;
}

/** Pings that finish after the load ends are aborted, so they cannot become loaded samples. */
async function throughput(direction: TransferStep["direction"], signal: AbortSignal) {
  const local = new AbortController();
  const combined = AbortSignal.any([signal, local.signal]);
  const field = direction === "download" ? "downloadLatency" : "uploadLatency";
  let pingFailure: string | undefined;
  const pinger = (async () => {
    while (!combined.aborted) {
      try {
        const sample = await ping(combined);
        if (!combined.aborted) publish({ [field]: [...session()[field], sample] });
        await delay(120, combined);
      } catch (error) {
        if (!combined.aborted) pingFailure = failure(error);
        break;
      }
    }
  })();
  try {
    for (const size of RUN.sizes) {
      signal.throwIfAborted();
      const url = fresh(`${SPEED}/${direction === "download" ? `__down?bytes=${size}` : "__up"}`);
      const result = await request(
        url,
        signal,
        direction === "upload" ? { method: "POST", body: new Uint8Array(size) } : {},
        false,
        RUN.timeoutMs,
      );
      if (direction === "download" && result.bytes !== size)
        throw new Error(
          `Expected ${size} bytes; received ${result.bytes}. Retry without a content filter.`,
        );
      // Upload requestStart→responseStart includes the upload; the browser offers no upload-only timing.
      const rate = mbps(
        size,
        direction === "download" && (result.transfer ?? 0) > 0
          ? (result.transfer ?? result.elapsed)
          : result.elapsed,
      );
      if (rate === undefined) throw new Error("The browser returned an invalid transfer duration.");
      const tcp = parseServerTiming(result.serverTiming);
      publish({
        steps: [
          ...session().steps,
          {
            id: `${direction}-${size}`,
            direction,
            bytes: size,
            ms: result.elapsed,
            rate,
            ttfb: result.ttfb,
            transfer: result.transfer,
            protocol: result.protocol,
          },
        ],
        ...(tcp ? { tcp } : {}),
      });
      log(
        `${direction} ${size / 1_000_000} MB · ${rate.toFixed(2)} Mbps · ${result.elapsed.toFixed(0)} ms`,
        "ok",
      );
      if (result.elapsed > RUN.slowStepMs) {
        log(`${direction}: step exceeded ${RUN.slowStepMs / 1000} s; larger sizes skipped.`);
        break;
      }
    }
  } finally {
    local.abort();
    await pinger;
    if (pingFailure)
      publish({ errors: [...session().errors, `${direction} loaded pings: ${pingFailure}`] });
  }
}

async function http3(signal: AbortSignal) {
  const host = "https://cloudflare-dns.com";
  const protocolNow = async () =>
    parseTrace((await request(fresh(`${host}/cdn-cgi/trace`), signal)).text).http;
  const before = await protocolNow();
  log(`Before DoH: cloudflare-dns.com reports ${before ?? "unknown"}.`);
  await request(`${host}/dns-query?name=example.com&type=A`, signal, {
    headers: { accept: "application/dns-json" },
  });
  log("One DoH query sent to the same origin; its Alt-Svc can advertise h3.");
  const after: string[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    await delay(250, signal);
    const protocol = await protocolNow();
    if (protocol) after.push(protocol);
    log(`Trace ${attempt + 1}: ${protocol ?? "unknown"}`, protocol === "http/3" ? "ok" : "sys");
    if (protocol === "http/3") break;
  }
  const outcome = h3Outcome(before, after);
  publish({ h3: outcome });
  log(H3_TEXT[outcome], onH3(outcome) ? "ok" : "warn");
}

export async function runConnection(): Promise<void> {
  if (controller) return;
  const own = new AbortController();
  controller = own;
  publish({ status: "running", ...EMPTY_RUN });
  const stage = async (stage: Stage, work: () => Promise<void>) => {
    own.signal.throwIfAborted();
    publish({ stage });
    log(STAGE_TITLE[stage]);
    try {
      await work();
    } catch (error) {
      own.signal.throwIfAborted();
      const message = `${STAGE_TITLE[stage]}: ${failure(error)}`;
      publish({ errors: [...session().errors, message] });
      log(message, "err");
    }
  };
  try {
    await stage("idle", async () => {
      await ping(own.signal); // Warm the connection; setup should not distort the idle sample distribution.
      for (let i = 0; i < RUN.idleSamples; i++) {
        const sample = await ping(own.signal);
        publish({ idle: [...session().idle, sample] });
        await delay(80, own.signal);
      }
    });
    await stage("download", () => throughput("download", own.signal));
    await stage("upload", () => throughput("upload", own.signal));
    await stage("h3", () => http3(own.signal));
    publish({ status: "complete", stage: undefined, finishedAt: new Date().toISOString() });
  } catch {
    publish({ status: "cancelled", stage: undefined });
    log("Run cancelled. Completed samples remain available.", "warn");
  } finally {
    if (controller === own) controller = undefined;
  }
}
