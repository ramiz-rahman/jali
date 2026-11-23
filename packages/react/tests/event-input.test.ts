/** Every event says where its change came from (`input`): a person's pointer or key, an agent, or the app's code. */
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type JaliInput } from "@jali/core";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});

let stops: (() => void)[] = [];
afterEach(() => {
  stops.forEach((s) => s());
  stops = [];
});

function make() {
  const jali = createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 }), note({ id: 3 })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
  });
  stops.push(jali.start());
  const seen: JaliInput[] = [];
  jali.on("close", ({ input }) => seen.push(input));
  const pane = () => jali.model().visible[0]!;
  return { jali, seen, pane };
}

const press = (type: string, init: Record<string, unknown> = {}) => {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, init);
  document.body.dispatchEvent(e);
};
const nextTask = () => new Promise((r) => setTimeout(r));

describe("event input", () => {
  it("is code when nothing a person did is behind it", async () => {
    const { jali, seen, pane } = make();
    await nextTask();
    jali.actions.close(pane());
    expect(seen).toEqual(["code"]);
  });

  it("is the pointer's kind for a change in that press's task, and code again after it", async () => {
    const { jali, seen, pane } = make();
    press("pointerdown", { pointerType: "touch" });
    jali.actions.close(pane());
    expect(seen).toEqual(["touch"]);
    await nextTask();
    jali.actions.close(pane());
    expect(seen).toEqual(["touch", "code"]);
  });

  it("is keyboard after a key, and virtual for a click with no press behind it", async () => {
    const { jali, seen, pane } = make();
    press("keydown");
    jali.actions.close(pane());
    await nextTask();
    press("click", { detail: 0 });
    jali.actions.close(pane());
    expect(seen).toEqual(["keyboard", "virtual"]);
  });
});
