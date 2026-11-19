// @vitest-environment node
/** A workspace renders on a server (Next.js, Astro, any renderToString): no window, no DOM, same markup to hydrate. */
import { describe, expect, it } from "vite-plus/test";
import { renderToString } from "react-dom/server";
import { createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Body of note {params.id}</p>,
});

describe("server rendering", () => {
  it("renders <JaliRoot> to HTML without a browser", () => {
    expect(typeof window).toBe("undefined");
    const jali = createJali({
      panes: [note],
      layout: row(note({ id: 1 }), note({ id: 2 })),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
    });
    const html = renderToString(<JaliRoot jali={jali} />);
    expect(html).toContain("jali-");
    expect(html).toContain("Note 1");
  });
});
