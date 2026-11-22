/**
 * Development checks follow `process.env.NODE_ENV`, as React's do (core-opus CORE-10). `import.meta.env.DEV` is Vite's
 * alone: under webpack, Next.js or esbuild the stability check and the default `onPaneError` were silently off.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryStorage, row } from "@jali/core";
import { isDev, storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const make = () =>
  createJali({
    panes: [item],
    layout: row({ kind: "item", params: { id: 1 } }),
    url: false,
    storage: memoryStorage(),
    size: { width: 1000, height: 600 },
    moveFocus: false,
  });

afterEach(() => vi.unstubAllEnvs());

describe("development mode", () => {
  it("is on unless NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDev()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(isDev()).toBe(false);
  });

  it("a production build reports no pane error by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(storeOf(make()).env.onPaneError).toBeUndefined();
    vi.stubEnv("NODE_ENV", "development");
    expect(storeOf(make()).env.onPaneError).toBeTypeOf("function");
  });
});
