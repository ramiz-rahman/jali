/** Bounded, uncached browser requests and Resource Timing; a timeout covers the body too. */
export const SPEED = "https://speed.cloudflare.com";
let serial = 0;

export function fresh(url: string): string {
  const target = new URL(url);
  target.searchParams.set("hs", `${Date.now()}-${serial++}`);
  return target.href;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public retryAt: number | undefined,
    message: string,
  ) {
    super(message);
  }
}

export function retryTime(raw: string | null, now = Date.now()): number | undefined {
  if (!raw) return undefined;
  const seconds = Number(raw);
  const date = Number.isFinite(seconds) ? now + Math.max(0, seconds) * 1000 : Date.parse(raw);
  return Number.isFinite(date) ? date : undefined;
}

export async function request(
  url: string,
  signal: AbortSignal,
  options: RequestInit = {},
  asText = true,
  timeoutMs = 15_000,
) {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  const started = performance.now();
  let observed: PerformanceResourceTiming | undefined;
  // Vite's module graph can fill the shared resource buffer before a test starts. An observer still receives
  // new entries, without clearing timings owned by other panes or changing the global buffer limit.
  const observer =
    typeof PerformanceObserver === "undefined"
      ? undefined
      : new PerformanceObserver((entries) => {
          observed =
            (entries.getEntries().find((entry) => entry.name === url) as
              | PerformanceResourceTiming
              | undefined) ?? observed;
        });
  observer?.observe({ type: "resource" });
  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store",
      credentials: "omit",
      signal: bounded,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new HttpError(
        response.status,
        retryTime(response.headers.get("retry-after")),
        `HTTP ${response.status} from ${new URL(url).hostname}`,
      );
    }
    const text = asText ? await response.text() : "";
    const bytes = asText ? 0 : (await response.arrayBuffer()).byteLength;
    const elapsed = performance.now() - started;
    // Resource completion is delivered after the response body's promise settles.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const timing =
      observed ??
      (performance.getEntriesByName(url, "resource").at(-1) as
        | PerformanceResourceTiming
        | undefined);
    // responseStart is hidden (zero) without Timing-Allow-Origin. Zero connection phases can mean reuse.
    const visible = timing && timing.responseStart > 0 && timing.requestStart > 0;
    const serverTiming =
      response.headers.get("server-timing") ??
      timing?.serverTiming?.map((entry) => `${entry.name};desc="${entry.description}"`).join(",") ??
      "";
    return {
      text,
      bytes,
      elapsed,
      serverTiming,
      ttfb: visible ? timing.responseStart - timing.requestStart : undefined,
      transfer: visible ? timing.responseEnd - timing.responseStart : undefined,
      protocol: visible ? timing.nextHopProtocol : undefined,
    };
  } finally {
    observer?.disconnect();
  }
}

export function failure(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "The request timed out. Check connectivity and retry.";
  if (error instanceof TypeError)
    return "The browser could not reach the source (offline, CORS, or a network filter). Check connectivity and retry.";
  return error instanceof Error
    ? error.message
    : "The request failed. Retry when the source is reachable.";
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
