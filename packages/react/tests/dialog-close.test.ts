/** A dialog's choice runs after it closes, on the next task, and never for an instance that ended meanwhile. */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryStorage, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { closeThen } from "../src/dialogs/close";

const make = () =>
  storeOf(
    createJali({
      panes: [{ kind: "note", title: "Note" }],
      layout: row({ kind: "note", params: {} }),
      storage: memoryStorage(),
    }),
  );

afterEach(() => vi.useRealTimers());

describe("closeThen", () => {
  it("closes at once and runs the choice on the next task", () => {
    vi.useFakeTimers();
    const order: string[] = [];
    closeThen(
      make(),
      () => order.push("close"),
      () => order.push("run"),
    );
    expect(order).toEqual(["close"]);
    vi.runAllTimers();
    expect(order).toEqual(["close", "run"]);
  });

  it("drops the choice when the instance ended before it ran", () => {
    vi.useFakeTimers();
    const store = make();
    const run = vi.fn();
    closeThen(store, () => {}, run);
    store.jali.destroy();
    vi.runAllTimers();
    expect(run).not.toHaveBeenCalled();
  });
});
