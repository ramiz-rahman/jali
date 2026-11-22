/**
 * In development, createJali, definePane and definePage warn once for each option they don't know (Data Studio's
 * script built its options at run time with 3a's old names, and Jali fell back to its defaults in silence). An option
 * that moved names where it went. A production build drops the check: tooling/size.mjs's `mustNotShip` has
 * core/src/dev-options.ts in every scenario.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryStorage, row, type JaliOptions } from "@jali/core";
import { definePage, definePane } from "@jali/react";
import { urlSync } from "./features";

const note = definePane("note", { params: { id: Number }, title: "Note", Component: () => null });
const warned = () => vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
const make = (extra: Record<string, unknown>) =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 })),
    storage: memoryStorage(),
    moveFocus: false,
    ...extra,
  } as JaliOptions);

afterEach(() => vi.restoreAllMocks());

describe("options Jali doesn't know", () => {
  it("names where each of 3a's and 3b's moved options went", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    make({
      keys: "scoped",
      keymap: {},
      keyPrefix: "Mod+J",
      reservedKeys: ["F2"],
      keymapOptions: {},
      palette: false,
      rename: { run: () => {} },
      url: { sizes: "link" },
    });
    expect(warned()).toEqual([
      'Jali: createJali has no option "keys": keys moved to keyboard.scope ("page", or "local" for "scoped")',
      'Jali: createJali has no option "keymap": keymap moved to keyboard.keymap',
      'Jali: createJali has no option "keyPrefix": keyPrefix moved to keyboard.prefix',
      'Jali: createJali has no option "reservedKeys": reservedKeys moved to keyboard.reserved',
      'Jali: createJali has no option "keymapOptions": keymapOptions moved to keyboard (keyboard.platform, keyboard.onInvalid, keyboard.words)',
      'Jali: createJali has no option "palette": palette is a feature: features: [palette()] from "jali/palette" (leave it out for palette: false)',
      'Jali: createJali has no option "rename": rename is a feature: features: [rename({ can, run })] from "jali/rename"',
      'Jali: createJali has no option "url": url is a feature: features: [urlSync({ location, prefix, sizes })] from "jali/url" (url takes only a writer of your own)',
    ]);
  });

  it("warns once per option, and not for a writer of the app's own or a known option", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    make({ colour: "red", url: { write: () => {} }, features: [urlSync()], name: "Notes" });
    make({ colour: "blue" });
    expect(warned()).toEqual(['Jali: createJali has no option "colour", and ignores it']);
  });

  it("checks definePane's and definePage's options too", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    definePane("wide", { title: "Wide", minWidth: 400, Component: () => null } as never);
    definePage({
      id: "p",
      name: "P",
      itemNoun: "item",
      roles: [],
      home: "x",
      firstItem: 1,
      bind: () => ({}),
      build: () => row(note({ id: 1 })),
      Header: () => null,
      tabs: [],
    } as never);
    expect(warned()).toEqual([
      'Jali: definePane has no option "minWidth": minWidth moved to width: { min }',
      'Jali: definePage has no option "tabs", and ignores it',
    ]);
  });
});
