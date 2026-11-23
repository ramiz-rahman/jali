/**
 * The minimal app's notes, embedded in a host page instead of being the page: two instances side by side, as an app
 * with Jali in two of its own panels has them. The host owns the address (its router), the theme and the reading
 * direction, so each instance is told whose they are.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createJali,
  row,
  type HistoryMode,
  type JaliOptions,
  type UrlState,
  type UrlWriter,
} from "jali";
import { JaliRoot, definePane } from "jali/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

/** The host's router: Jali writes the layout into it, and its own address is what "Copy link" copies. */
function hostRouter() {
  const writes: { state: UrlState; mode: HistoryMode }[] = [];
  const writer: UrlWriter = {
    write: (state, mode) => void writes.push({ state: state(), mode }),
    href: () => "https://host.example/desk?notes=2",
  };
  return { writes, writer };
}

const mounted: Root[] = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.unmount()));
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-theme");
});

/** One instance in a panel of the host's page. */
function embed(options: Pick<JaliOptions, "id" | "label" | "url">) {
  const jali = createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    ...options,
    // The host page has its own theme and reads right to left; panes sit closer than Jali's default.
    pageTheme: false,
    dir: "rtl",
    gap: 2,
    size: { width: 900, height: 600 },
  });
  const panel = document.body.appendChild(document.createElement("div"));
  const root = createRoot(panel);
  mounted.push(root);
  act(() => root.render(<JaliRoot jali={jali} />));
  return { jali, panel };
}

describe("the minimal app's notes, embedded twice in a host page", () => {
  it("names each instance's landmark, and keeps their ids apart", () => {
    const orders = embed({ id: "orders", label: "Orders" });
    const notes = embed({ id: "notes", label: "Notes" });
    const names = [...document.querySelectorAll('[role="region"], section[aria-label]')]
      .map((el) => el.getAttribute("aria-label"))
      .filter((name) => name === "Orders" || name === "Notes");
    expect(new Set(names)).toEqual(new Set(["Orders", "Notes"]));
    const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(orders.panel.querySelector('[id^="orders"]')).not.toBeNull();
    expect(notes.panel.querySelector('[id^="notes"]')).not.toBeNull();
  });

  it("leaves the page's theme to the host, and reads right to left with the host's gap", () => {
    const { panel } = embed({ id: "notes", label: "Notes" });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    const root = panel.firstElementChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
    expect(root.style.getPropertyValue("--jali-gap")).toBe("2px");
  });

  it("writes its layout through the host's router, which gives the link to copy", () => {
    const router = hostRouter();
    const { jali } = embed({ id: "notes", label: "Notes", url: router.writer });
    act(() => void jali.actions.openBeside(jali.model().panes[1]!.id, note({ id: 3 })));
    const last = router.writes.at(-1);
    expect(last?.mode).toBe("push");
    expect(JSON.stringify(last?.state.layout)).toContain('"id":3');
    expect(jali.href()).toBe("https://host.example/desk?notes=2");
  });
});
