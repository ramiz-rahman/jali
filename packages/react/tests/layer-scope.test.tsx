/**
 * The workspace's direction, theme and tokens reach its dialogs (react-codex REACT-15): `<JaliRoot dir>` and a host's
 * `data-theme` and `--jali-*` tokens on the root are the dialog layer's too, and the measured gap and inset are the
 * layout's, whatever `style` says.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

const note = definePane("note", { title: () => "Note", Component: () => null });
const make = () =>
  createJali({
    panes: [note],
    layout: pane(note({}), { id: "a" }),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("the dialog layer", () => {
  it("takes the root's dir, data-theme and tokens", () => {
    const jali = make();
    render(
      <JaliRoot
        jali={jali}
        dir="rtl"
        data-theme="dark"
        style={{
          ["--jali-accent" as string]: "red",
          ["--jali-gap" as string]: "40px",
          color: "blue",
        }}
      />,
    );
    act(() => void jali.dialogs.openSettings());
    const layer = document.querySelector<HTMLElement>("[data-jali-layer]")!;
    expect(layer.getAttribute("dir")).toBe("rtl");
    expect(layer.getAttribute("data-theme")).toBe("dark");
    expect(layer.style.getPropertyValue("--jali-accent")).toBe("red");
    expect(layer.style.color).toBe("");
    const root = document.querySelector<HTMLElement>("[data-jali]")!;
    expect(root.style.getPropertyValue("--jali-gap")).not.toBe("40px");
  });
});
