/**
 * A curated page's link is read as the page's own (core-codex CORE-2): an item a numbered page can't take never reaches
 * its `bind` as text, and a link to another page doesn't open this one with that link's item.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const loan = { kind: "loan", title: "Loan", params: { id: Number }, width: { min: 200 } };
const bound: unknown[] = [];
const book = definePage({
  id: "book",
  name: "Book",
  itemNoun: "loan",
  home: "main",
  roles: [{ id: "main", label: "Loan", priority: "primary" as const }],
  firstItem: 1,
  bind: (item: number) => {
    bound.push(item);
    // A bind written for numbers.
    return { main: { kind: "loan", params: { id: Number(item.toFixed(0)) } } };
  },
  build: (item: number) =>
    pane({ kind: "loan", params: { id: item } }, { id: "main", role: "main" }),
});
const make = (search: string) =>
  createJali({
    panes: [loan],
    page: book,
    features: [urlSync({ location: memoryLocation(search) })],
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });

describe("a page link", () => {
  it("whose item the page can't take opens the first item", () => {
    bound.length = 0;
    const jali = make("?page=book&item=abc");
    expect(jali.get().page?.item).toBe(1);
    expect(bound.every((i) => typeof i === "number")).toBe(true);
  });

  it("reads a numbered page's item as a number", () => {
    expect(make("?page=book&item=7").get().page?.item).toBe(7);
  });

  it("to another page leaves this one's item alone", () => {
    expect(make("?page=other&item=9").get().page?.item).toBe(1);
  });

  it("an app's call with an item the page can't take is refused", () => {
    const jali = make("");
    expect(jali.page!.showItem("abc" as never).reason).toBe("invalid");
    expect(jali.page!.open({ item: "abc" } as never).reason).toBe("invalid");
  });
});
