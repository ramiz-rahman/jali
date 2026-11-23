/**
 * The curated page is opt-in (QUALITY-REVIEW P3): its code, its commands and its words come with a page made by
 * `definePage`, so a workspace without one has none of them. `pnpm size` checks that the minimal app ships none of the
 * page's modules; these check what the workspace does without them.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  en,
  listCommands,
  memoryLocation,
  memoryStorage,
  pane,
  type JaliOptions,
} from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";
import { storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const ticket = { kind: "ticket", title: "Ticket", params: { id: String } };
const desk = {
  id: "desk",
  name: "Desk",
  itemNoun: "ticket",
  home: "main",
  roles: [{ id: "main", label: "Ticket", priority: "primary" as const }],
  firstItem: "t-1",
  bind: (item: string) => ({ main: { kind: "ticket", params: { id: item } } }),
  build: (item: string) =>
    pane({ kind: "ticket", params: { id: item } }, { id: "main", role: "main" }),
};

const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [ticket],
    features: [urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...o,
  });

describe("a workspace without a curated page", () => {
  const jali = make({ layout: { kind: "ticket", params: { id: "t-1" } } });

  it("has no page engine, page commands or page words", () => {
    expect(storeOf(jali).env.page).toBeUndefined();
    expect(listCommands(jali).filter((c) => c.id?.startsWith("page."))).toEqual([]);
    expect((jali.messages as { page?: unknown }).page).toBeUndefined();
  });

  it("has no page actions, and its engine's page steps are refused as unavailable", () => {
    expect(jali.page).toBeUndefined();
    expect(storeOf(jali).run("page.open")).toMatchObject({ ok: false, reason: "unavailable" });
    expect(storeOf(jali).run("page.setMode", "split")).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    expect(storeOf(jali).actions.placeTab("main", "x", "left")).toMatchObject({
      reason: "unavailable",
    });
  });

  it("ignores a page link", () => {
    const j = make({
      layout: { kind: "ticket", params: { id: "t-1" } },
      features: [urlSync({ location: memoryLocation("?page=desk&item=t-2") })],
    });
    expect(j.get().page).toBeNull();
    expect(j.getLayout().root).toMatchObject({ ref: { params: { id: "t-1" } } });
  });
});

describe("a workspace with a page from definePage", () => {
  it("runs the page, lists its commands, and says its words", () => {
    const jali = make({ page: definePage(desk) });
    expect(storeOf(jali).env.page).toBeDefined();
    expect(jali.get().page).toMatchObject({ profile: "desk", item: "t-1" });
    expect(listCommands(jali).some((c) => c.id === "page.open")).toBe(true);
    expect(jali.messages.page).toEqual(en.page);
    expect(jali.messages.announcements.pageOpened).toBe(en.announcements.pageOpened);
  });

  it("takes a translation of the page's words over its English", () => {
    const jali = make({
      page: definePage(desk),
      messages: {
        page: { backTo: (p) => `Retour à ${p}` },
        commands: { pageReset: "Réinitialiser" },
      },
    });
    expect(jali.messages.page.backTo("Desk")).toBe("Retour à Desk");
    expect(jali.messages.page.reset).toBe(en.page.reset);
    expect(listCommands(jali).find((c) => c.id === "page.reset")?.title).toBe("Réinitialiser");
  });

  it("keeps the page's fields as given, and leaves the given object alone", () => {
    const page = definePage(desk);
    expect(page).not.toBe(desk);
    expect(page).toMatchObject(desk);
    expect(Object.getOwnPropertySymbols(desk)).toEqual([]);
  });
});

describe("a page not made with definePage", () => {
  it("is refused at creation, saying how to make one", () => {
    expect(() => make({ page: desk })).toThrow(/definePage/);
  });
});
