/**
 * The host's code in Jali's chrome stays inside a boundary (react-opus REACT-3, react-codex REACT-3): a pane's header
 * controls fail with their pane, a kind's icon, a host icon, a page's rail or header and Settings' extra fieldsets
 * fail alone, and anything else fails inside the workspace, never taking the host's app down with it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type AnyJali } from "@jali/core";
import { JaliRoot, JaliView, definePage, definePane, useHeaderActions } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom(): never {
  throw new Error("boom");
}

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => {
    useHeaderActions(params.id === 2 ? <Boom /> : null);
    return <p>note body {params.id}</p>;
  },
});
const iconic = definePane("iconic", {
  title: () => "Iconic",
  icon: Boom,
  Component: () => <p>iconic body</p>,
});

const make = (opts: Record<string, unknown> = {}): AnyJali =>
  createJali({
    panes: [note, iconic],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...opts,
  });

const App = ({ children }: { children: React.ReactNode }) => (
  <div>
    <p>host app</p>
    {children}
  </div>
);

describe("boundaries around the host's code in Jali's chrome", () => {
  it("a header control that throws fails its own pane only", () => {
    const onPaneError = vi.fn();
    render(
      <App>
        <JaliRoot jali={make({ onPaneError })} />
      </App>,
    );
    expect(screen.getByText("host app")).toBeTruthy();
    expect(screen.getByText("note body 1")).toBeTruthy();
    expect(screen.queryByText("note body 2")).toBeNull();
    expect(screen.getByText(/Note 2 could not be shown/)).toBeTruthy();
    expect(onPaneError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ pane: "b" }),
    );
  });

  it("a kind's icon that throws leaves the pane", () => {
    const jali = make({
      layout: row(pane(iconic({}), { id: "i" }), pane(note({ id: 1 }), { id: "a" })),
    });
    render(
      <App>
        <JaliRoot jali={jali} />
      </App>,
    );
    expect(screen.getByText("iconic body")).toBeTruthy();
    expect(screen.getByText("note body 1")).toBeTruthy();
  });

  it("a host icon that throws is replaced by Jali's own", () => {
    const { container } = render(
      <App>
        <JaliRoot
          jali={make({ layout: pane(note({ id: 1 }), { id: "a" }) })}
          icons={{ close: Boom }}
        />
      </App>,
    );
    expect(screen.getByText("note body 1")).toBeTruthy();
    expect(container.querySelector('[data-action="close"] svg')).not.toBeNull();
  });

  it("Settings' extra fieldsets that throw leave Settings", () => {
    const jali = make({ layout: pane(note({ id: 1 }), { id: "a" }) });
    render(
      <App>
        <JaliRoot jali={jali} settingsExtra={<Boom />} />
      </App>,
    );
    act(() => void jali.dialogs.openSettings());
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("note body 1")).toBeTruthy();
  });

  it("a page's header that throws leaves its tabs and panes", () => {
    const Icon = () => null;
    const page = definePage({
      id: "visit",
      name: "Visit",
      itemNoun: "visit",
      home: "summary",
      roles: [{ id: "summary", label: "Summary", priority: "primary", icon: Icon }],
      firstItem: 1,
      bind: (item: number) => ({ summary: note({ id: item }) }),
      build: (item: number) => pane(note({ id: item }), { id: "summary", role: "summary" }),
      Header: Boom,
      Rail: Boom,
    });
    const jali = make({ page, layout: undefined });
    render(
      <App>
        <JaliRoot jali={jali}>
          <JaliView />
        </JaliRoot>
      </App>,
    );
    act(() => void jali.page!.open());
    expect(screen.getByRole("tablist", { name: "Visit views" })).toBeTruthy();
    expect(screen.getByText("note body 1")).toBeTruthy();
  });

  it("anything else fails inside the workspace, with Retry, and the host's app stays", () => {
    const onError = vi.fn();
    let broken = true;
    function Chrome() {
      if (broken) throw new Error("chrome");
      return <p>chrome back</p>;
    }
    render(
      <App>
        <JaliRoot jali={make()} onError={onError}>
          <Chrome />
          <JaliView />
        </JaliRoot>
      </App>,
    );
    expect(screen.getByText("host app")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/could not be shown/);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("chrome back")).toBeTruthy();
    expect(screen.getByText("note body 1")).toBeTruthy();
  });
});
