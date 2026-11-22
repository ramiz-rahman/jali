/**
 * An action builds the model only when something reads it (core-opus CORE-17). `apply` took a snapshot to read the
 * workspace's kinds or words, and each snapshot resolved the layout it had just written: work nobody used.
 * Counted here by the reads of `phone.below`, which every model lookup and every build reads.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });

describe("the model", () => {
  it("is not built for a snapshot nobody reads it from", () => {
    let reads = 0;
    const jali = createJali({
      panes: [item],
      layout: row(ref(1), ref(2)),
      url: false,
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
      phone: {
        get below() {
          reads++;
          return 600;
        },
      },
    });
    const first = jali.model().resolved.panes[0]!.id;
    reads = 0;
    storeOf(jali).snapshot();
    expect(reads).toBe(0);
    jali.actions.openBeside(first, ref(3));
    const action = reads;
    reads = 0;
    jali.model();
    // The action read the model it acted on, and resolved the layout it wrote only once something read it.
    expect({ action, after: reads > 0 }).toEqual({ action: 1, after: true });
  });
});
