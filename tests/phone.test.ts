/** Phones: under `phone.below` (default 600px) of workspace width, the workspace shows Single view. */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type PhoneOptions } from "@jali/core";
import { definePane } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 160 },
  Component: () => null,
});

const at = (width: number, phone?: PhoneOptions) =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width, height: 800 },
    moveFocus: false,
    ...(phone ? { phone } : {}),
  }).model();

describe("phone width", () => {
  it("is Single view under 600px, even when narrow panes would tile", () => {
    expect(at(378).single).toBe(true);
    expect(at(599).single).toBe(true);
    expect(at(600).single).toBe(false);
  });

  it("moves with phone.below, and below: 0 leaves it to the panes' minimums", () => {
    expect(at(700, { below: 768 }).single).toBe(true);
    expect(at(378, { below: 0 }).single).toBe(false);
    // Two notes fold into tabs at 200px; at 150px even one (160px minimum) can't fit.
    expect(at(200, { below: 0 }).single).toBe(false);
    expect(at(150, { below: 0 }).single).toBe(true);
  });
});
