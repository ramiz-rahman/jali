/** The app-facing API: definePane, createWorkspace with the layout builders, <Jali> and the pane hooks. */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useState } from "react";
import { createWorkspace, memoryLocation, memoryStorage, pane, row, type WorkspaceOptions } from "@jali/core";
import { Jali, definePane, useActivity, useCommands, usePane, useUnsaved } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 240, max: 600 },
  Component: ({ params }) => <NoteBody id={params.id} />,
});

function NoteBody({ id }: { id: number }) {
  const { openBeside } = usePane();
  const [draft, setDraft] = useState("");
  useActivity(draft ? "working" : "idle");
  useUnsaved(draft && "an unsaved note");
  useCommands([{ id: "next", title: `Open note ${id + 1}`, run: () => openBeside(note({ id: id + 1 })) }]);
  return <textarea aria-label={`Draft of note ${id}`} value={draft} onChange={(e) => setDraft(e.target.value)} />;
}

const launcher = definePane("launcher", { title: "New pane", scratch: true, Component: () => <p>Choose</p> });

/** A workspace with nothing shared: its own address and storage, a fixed size, DOM focus left alone. */
const make = (options: Partial<WorkspaceOptions> = {}) =>
  createWorkspace({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...options,
  });

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("definePane", () => {
  it("is called to name an object of its kind", () => {
    expect(note({ id: 3 })).toEqual({ kind: "note", params: { id: 3 } });
    expect(note.kind).toBe("note");
    // @ts-expect-error: a note needs its id
    note();
    // @ts-expect-error: and its id is a number
    note({ id: "3" });
  });

  it("reads params back with their types, for the title and the component", () => {
    const workspace = make({ layout: row(pane({ kind: "note", params: { id: "7" } }, { id: "seven" })) });
    expect(workspace.env.kinds.params(workspace.model().pane("seven")!.ref)).toEqual({ id: 7 });
    expect(workspace.model().title("seven")).toBe("Note 7");
  });

  it("gives sizes defaults, so a kind only states what it needs", () => {
    const kind = make().env.kinds.registry().note!;
    expect([kind.minWidth, kind.minHeight, kind.maxWidth]).toEqual([240, 160, 600]);
  });

  it("knows scratch kinds are never the same object and stay out of Recent by default", () => {
    const { kinds } = make({ panes: [note, launcher] }).env;
    expect(kinds.sameObject(launcher(), launcher())).toBe(false);
    expect(kinds.isRecordable(launcher())).toBe(false);
    expect(kinds.sameObject(note({ id: 1 }), { kind: "note", params: { id: "1" } })).toBe(true);
  });
});

describe("createWorkspace", () => {
  it("opens on its layout, fitted and focused, ready before the first render", () => {
    const workspace = make();
    expect(workspace.model().panes.map((p) => p.id)).toEqual(["note", "note-2"]);
    expect(workspace.get().view.focused).toBe("note");
  });

  it("writes the layout to the address and reads it back", () => {
    const location = memoryLocation();
    make({ url: { location } }).actions.openBeside("note", note({ id: 9 }));
    const again = make({ url: { location }, layout: row(note({ id: 1 })) });
    expect(again.model().panes.map((p) => p.ref.params.id)).toEqual([1, 9, 2]);
  });

  it("offers Split only with a launcher, which it marks transient", () => {
    expect(make().actions.split("right")).toBeUndefined();
    const workspace = make({ launcher });
    const opened = workspace.actions.split("right");
    expect(workspace.model().pane(opened!)?.ref.kind).toBe("launcher");
    expect(workspace.env.kinds.isTransient(launcher())).toBe(true);
  });

  it("builds a preset each time it is chosen", () => {
    const workspace = make({ layout: undefined, presets: [{ id: "one", label: "One", layout: () => row(note({ id: 5 })) }] });
    workspace.actions.close("note");
    workspace.actions.preset("one");
    expect(workspace.model().panes.map((p) => p.ref.params.id)).toEqual([5]);
  });
});

describe("<Jali> and the pane hooks", () => {
  it("renders the workspace and reports what each pane says about itself", async () => {
    const workspace = make({ layout: row(note({ id: 1 })) });
    const { getByLabelText } = render(<Jali workspace={workspace} />);
    expect(getByLabelText("Draft of note 1")).toBeTruthy();
    expect(workspace.get().paneCommands.note?.map((c) => c.title)).toEqual(["Open note 2"]);

    const text = getByLabelText("Draft of note 1") as HTMLTextAreaElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(text, "Buy milk");
      text.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(workspace.get().unsaved.note).toBe("an unsaved note");
    expect(workspace.get().activity.note).toBe("working");

    // A command runs the latest `run` it was given.
    await act(async () => workspace.get().paneCommands.note![0]!.run());
    expect(workspace.model().panes.map((p) => p.ref.params.id)).toEqual([1, 2]);
  });

  it("starts the workspace's listeners while mounted, once", () => {
    const workspace = make();
    const { unmount } = render(<Jali workspace={workspace} />);
    expect(workspace.start()).toBeTypeOf("function"); // already started: a no-op stop
    unmount();
    const stop = workspace.start(); // stopped on unmount, so this starts it again
    stop();
  });
});
