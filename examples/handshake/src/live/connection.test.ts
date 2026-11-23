/** Run orchestration with a fixture transport: checks the traffic bound, cancellation and partial failure. */
import { vi } from "vitest";
import { delay, request } from "./http";
import { cancelConnection, connectionStore, runConnection } from "./connection";

const getConnection = () => connectionStore.get();

vi.mock("./http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./http")>();
  return { ...actual, request: vi.fn() };
});

const response = (text = "", elapsed = 10, bytes = 0) => ({
  text,
  elapsed,
  bytes,
  serverTiming: 'cfL4;desc="?rtt=4919&cwnd=55"',
  ttfb: 5,
  transfer: elapsed - 5,
  protocol: "http/1.1",
});
let traces = 0;
beforeEach(() => {
  vi.useFakeTimers();
  traces = 0;
  vi.mocked(request).mockImplementation(async (url, signal) => {
    if (url.includes("cdn-cgi/trace"))
      return response(`ip=203.0.113.7\nhttp=${traces++ ? "http/3" : "http/2"}\n`);
    if (url.includes("dns-query")) return response('{"Status":0}');
    const bytes = Number(new URL(url).searchParams.get("bytes"));
    if (url.includes("__up") || bytes > 0) {
      await delay(300, signal);
      return response("", 1601, bytes);
    }
    await delay(10, signal);
    return response();
  });
});
afterEach(() => {
  cancelConnection();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("runs one job, collects 20 idle samples, stops increasing size, and records an observed H3 flip", async () => {
  const first = runConnection();
  await runConnection();
  await vi.runAllTimersAsync();
  await first;
  const result = getConnection();
  expect(result.status).toBe("complete");
  expect(result.idle).toHaveLength(20);
  expect(result.steps.map((step) => [step.direction, step.bytes])).toEqual([
    ["download", 100_000],
    ["upload", 100_000],
  ]);
  expect(result.downloadLatency.length).toBeGreaterThanOrEqual(2);
  expect(result.h3).toBe("switched");
  expect(result.errors).toEqual([]);
  expect(vi.mocked(request).mock.calls.filter(([url]) => url.includes("dns-query"))).toHaveLength(
    1,
  );
});

it("cancels in flight and retains only completed samples", async () => {
  const run = runConnection();
  await vi.advanceTimersByTimeAsync(400);
  cancelConnection();
  await vi.runAllTimersAsync();
  await run;
  const result = getConnection();
  expect(result.status).toBe("cancelled");
  expect(result.idle.length).toBeGreaterThan(0);
  expect(result.idle.length).toBeLessThan(20);
  expect(result.steps).toEqual([]);
  const calls = vi.mocked(request).mock.calls.length;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(vi.mocked(request).mock.calls).toHaveLength(calls);
});

it("keeps upload and HTTP/3 independent when download fails", async () => {
  const transport = vi.mocked(request).getMockImplementation();
  vi.mocked(request).mockImplementation((url, signal, options, asText, timeout) => {
    if (url.includes("__down") && Number(new URL(url).searchParams.get("bytes")) > 0)
      return Promise.reject(new TypeError("offline"));
    if (!transport) throw new Error("Missing fixture transport");
    return transport(url, signal, options, asText, timeout);
  });
  const run = runConnection();
  await vi.runAllTimersAsync();
  await run;
  expect(getConnection().errors[0]).toContain("Download");
  expect(getConnection().steps.map((step) => step.direction)).toEqual(["upload"]);
  expect(getConnection().h3).toBe("switched");
});
