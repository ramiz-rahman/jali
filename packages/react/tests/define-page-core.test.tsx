/**
 * A page made with only an engine (@jali/core/adapter's `definePageEngine`) has no React parts, so `<JaliView>` can't render it (react-opus
 * REACT-13). In development Jali says so, naming the fix, instead of silently showing bare panes.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { definePageEngine as defineCorePage } from "@jali/core/adapter";
import { JaliRoot, definePage, definePane } from "@jali/react";

afterEach(cleanup);

const visit = definePane("visit", {
  params: { id: Number },
  title: ({ id }) => `Visit ${id}`,
  Component: () => null,
});
const Icon = () => null;
const spec = {
  id: "visit",
  name: "Visit",
  itemNoun: "visit",
  home: "summary",
  roles: [{ id: "summary", label: "Summary", priority: "primary" as const, icon: Icon }],
  firstItem: 1,
  bind: (item: number) => ({ summary: visit({ id: item }) }),
  build: (item: number) => pane(visit({ id: item }), { id: "summary", role: "summary" }),
  Header: ({ item }: { item: number }) => <h1>Visit {item}</h1>,
};
const make = (page: unknown) =>
  createJali({
    panes: [visit],
    page: page as ReturnType<typeof definePage>,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("a page from @jali/core's definePage", () => {
  it("is a development error that names @jali/react's definePage", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<JaliRoot jali={make(defineCorePage(spec))} />);
    expect(error.mock.calls.flat().join(" ")).toMatch(/definePage.*@jali\/react/);
    error.mockRestore();
  });

  it("@jali/react's definePage says nothing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<JaliRoot jali={make(definePage(spec))} />);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
