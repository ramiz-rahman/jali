/**
 * Every button Jali renders says `type="button"`, so a workspace inside a host's `<form>` never submits it
 * (react-opus REACT-7). The rendered workspace is scanned in the states that draw most of Jali's buttons (tabs, a
 * shelf, the palette, settings, a curated page), and the source is scanned for the rest.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePage, definePane } from "@jali/react";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 200 },
  Component: () => null,
});
const Icon = () => null;
const page = definePage({
  id: "visit",
  name: "Visit",
  itemNoun: "visit",
  home: "summary",
  roles: [{ id: "summary", label: "Summary", priority: "primary", icon: Icon }],
  firstItem: 1,
  bind: (item: number) => ({ summary: note({ id: item }) }),
  build: (item: number) => pane(note({ id: item }), { id: "summary", role: "summary" }),
  Header: ({ item }) => <h1>Visit {item}</h1>,
});

const untyped = () => [...document.querySelectorAll("button:not([type])")].map((b) => b.outerHTML);

describe("Jali's buttons inside a host's form", () => {
  it("are all type=button, and pressing one doesn't submit the form", () => {
    const jali = createJali({
      panes: [note],
      page,
      layout: row(
        tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
        pane(note({ id: 3 }), { id: "c" }),
        pane(note({ id: 4 }), { id: "d" }),
      ),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    const submit = vi.fn((e: { preventDefault(): void }) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <JaliRoot jali={jali}>
          <JaliView />
          <Shelf />
        </JaliRoot>
      </form>,
    );
    act(() => void jali.actions.tuck("d"));
    expect(untyped()).toEqual([]);
    for (const b of document.querySelectorAll<HTMLButtonElement>(".jali-pane-header button"))
      if (!b.closest("[data-action=close]") && !b.closest(".jali-tab-close")) fireEvent.click(b);
    expect(submit).not.toHaveBeenCalled();

    act(() => void jali.dialogs.openPalette());
    expect(untyped()).toEqual([]);
    act(() => void jali.dialogs.closePalette());
    act(() => void jali.dialogs.openSettings());
    expect(untyped()).toEqual([]);
    act(() => void jali.dialogs.closeSettings());
    act(() => void jali.page!.open());
    expect(untyped()).toEqual([]);
  });

  it("in the source: no <button without a type", () => {
    const src = join(__dirname, "../src");
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? files(p) : f.endsWith(".tsx") ? [p] : [];
      });
    const bare: string[] = [];
    for (const f of files(src)) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/<button\b[^>]*?>/gs))
        if (!/\btype=/.test(m[0])) bare.push(`${f.slice(src.length)}: ${m[0].slice(0, 60)}`);
    }
    expect(bare).toEqual([]);
  });
});
