/** A paused read does no work but keeps listening (hooks.ts, `activity`). */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createDataLayer } from "./index";
import { useRecord } from "./hooks";
import { isLoading } from "./hooks";
import { DataLayerProvider } from "./react";

const layer = createDataLayer();
beforeAll(() => layer.api.ready(), 30_000);
afterEach(() => {
  cleanup();
  layer.queryClient.clear();
});

let seen: { data: unknown; loading: boolean }[] = [];
function Reader({ id, paused }: { id: string; paused: boolean }) {
  const q = useRecord("customers", id, { paused });
  seen.push({ data: q.data, loading: isLoading(q) });
  return null;
}
const app = (paused: boolean, id = "3") => (
  <DataLayerProvider value={layer}>
    <Reader id={id} paused={paused} />
  </DataLayerProvider>
);
const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 10)));
  expect(check()).toBe(true);
};

describe("a paused read", () => {
  it("fetches nothing and is not loading", async () => {
    seen = [];
    const before = layer.stats().fetches;
    render(app(true));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(layer.stats().fetches).toBe(before);
    expect(seen.every((s) => s.data === undefined && !s.loading)).toBe(true);
  });

  it("hears an answer fetched by someone else for the same key, then shows it without fetching", async () => {
    seen = [];
    const view = render(app(true));
    await layer.queryClient.fetchQuery({
      queryKey: layer.keys.record("customers", "3"),
      queryFn: () => layer.api.record("customers", "3"),
    });
    await until(() => seen.at(-1)?.data != null);
    const fetches = layer.stats().fetches;
    view.rerender(app(false));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(layer.stats().fetches).toBe(fetches);
    expect(seen.at(-1)).toMatchObject({ loading: false });
    expect(seen.at(-1)?.data).toMatchObject({ id: 3 });
  });

  it("fetches once it is unpaused, when nothing had it", async () => {
    seen = [];
    const view = render(app(true, "4"));
    view.rerender(app(false, "4"));
    await until(() => seen.at(-1)?.data != null);
    expect(seen.at(-1)?.data).toMatchObject({ id: 4 });
  });
});
