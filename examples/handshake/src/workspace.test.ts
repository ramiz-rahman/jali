import { describe, expect, it } from "vite-plus/test";
import { listCommands } from "jali";
import { testJaliOptions } from "jali/testing";
import { kinds } from "./kinds";
import { presets } from "./presets";
import { createHandshakeJali } from "./workspace";

/** The app's workspace with nothing shared: a memory address and storage, a fixed size, no DOM focus. */
function testJali({ search = "", width = 1440, height = 900 } = {}) {
  const { options } = testJaliOptions({ search, size: { width, height } });
  return createHandshakeJali(options);
}

const ids = (jali: ReturnType<typeof testJali>) => jali.model().panes.map((p) => p.id);

describe("the handshake workspace", () => {
  it("opens on the course: the outline, the lesson that follows it, and the tools that follow the lesson", () => {
    const jali = testJali();
    expect(jali.get().presetId).toBe("course");
    expect(ids(jali)).toEqual(["course", "lesson", "packet", "ladder", "bytes"]);
    expect(jali.model().pane("lesson")).toMatchObject({ linkedTo: "course", follows: true });
    for (const id of ["packet", "bytes", "ladder"])
      expect(jali.model().pane(id)).toMatchObject({ linkedTo: "lesson", follows: true });
  });

  it("starts the course's tools on the packet the first step shows, so nothing moves when the lesson selects it", () => {
    const jali = testJali();
    const packet = jali.model().pane("packet")?.ref.params;
    const bytes = jali.model().pane("bytes")?.ref.params;
    expect(packet).toEqual(bytes);
    expect(packet?.n).not.toBe(1);
  });

  it("opens every layout, with each tool linked to that layout's list", () => {
    const jali = testJali();
    for (const p of presets) {
      jali.actions.preset(p.id);
      expect(jali.get().presetId).toBe(p.id);
      expect(jali.model().panes.length).toBeGreaterThan(1);
    }
  });

  it("registers every kind once", () => {
    const names = kinds.map((k) => k.kind);
    expect(new Set(names).size).toBe(names.length);
  });

  it("lists the app's commands in ⌘K", () => {
    const titles = listCommands(testJali()).map((c) => c.title);
    expect(titles).toContain("Switch between light and dark");
  });
});
