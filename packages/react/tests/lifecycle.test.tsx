/**
 * Lifecycle, said once (docs/API-REVIEW.md, section 10): `<JaliRoot>` starts and stops the workspace itself; outside
 * React, `start()` returns `stop` and can start again; `destroy()` is the end, and every call after it is refused.
 * "Started" is seen through the keys: the palette's key opens the palette only while the workspace listens.
 */
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

const make = () =>
  createJali({
    panes: [note],
    layout: note({ id: 1 }),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    keyboard: { platform: "other" },
  });

/** Ctrl+K on the page: the palette's key. Says whether the workspace took it. */
function pressPaletteKey(jali: ReturnType<typeof make>): boolean {
  const before = jali.get().paletteOpen;
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }),
    );
  });
  const took = jali.get().paletteOpen !== before;
  if (took) act(() => void jali.dialogs.closePalette());
  return took;
}

afterEach(cleanup);

describe("outside React", () => {
  it("takes no keys until started", () => {
    const jali = make();
    expect(pressPaletteKey(jali)).toBe(false);
    const stop = jali.start();
    expect(pressPaletteKey(jali)).toBe(true);
    stop();
  });

  it("start() returns stop, and can start again after it", () => {
    const jali = make();
    const stop = jali.start();
    stop();
    expect(pressPaletteKey(jali)).toBe(false);
    const again = jali.start();
    expect(pressPaletteKey(jali)).toBe(true);
    again();
    expect(pressPaletteKey(jali)).toBe(false);
  });

  it("starting twice listens once, and one stop ends it", () => {
    const jali = make();
    const stop = jali.start();
    jali.start();
    expect(pressPaletteKey(jali)).toBe(true);
    stop();
    expect(pressPaletteKey(jali)).toBe(false);
  });

  it("destroy() is the end: it stops, start() does nothing after it, and every action is refused", () => {
    const jali = make();
    jali.start();
    jali.destroy();
    expect(pressPaletteKey(jali)).toBe(false);
    jali.start();
    expect(pressPaletteKey(jali)).toBe(false);
    expect(jali.actions.close()).toEqual({ ok: false, reason: "unavailable" });
    expect(jali.dialogs.openSettings()).toEqual({ ok: false, reason: "unavailable" });
    expect(jali.setLayout(note({ id: 2 }))).toEqual({ ok: false, reason: "unavailable" });
    // Its state can still be read.
    expect(jali.model().panes).toHaveLength(1);
  });
});

describe("<JaliRoot>", () => {
  it("starts the workspace while mounted and stops it on unmount, in StrictMode too", () => {
    const jali = make();
    const view = render(
      <StrictMode>
        <JaliRoot jali={jali} />
      </StrictMode>,
    );
    expect(pressPaletteKey(jali)).toBe(true);
    view.unmount();
    expect(pressPaletteKey(jali)).toBe(false);
  });

  it("starts it again when it mounts again", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />).unmount();
    render(<JaliRoot jali={jali} />);
    expect(pressPaletteKey(jali)).toBe(true);
  });
});
