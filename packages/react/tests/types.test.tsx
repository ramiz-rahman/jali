/**
 * Types flow from the kinds an app registers (docs/API-REVIEW.md, section 3). These are checked by the typecheck gate,
 * not at run time: a sample here that stops compiling, or a line under `@ts-expect-error` that starts to, fails it.
 *
 * Three samples: the quickstart (examples/minimal), a curated page, and chrome of the app's own around the panes. The
 * React hooks are typed here through their explicit parameter; `Register` (one declaration for the whole app) has its
 * own project in type-tests/, because a module augmentation reaches every file of a program.
 */
import { describe, expectTypeOf, it } from "vite-plus/test";
import {
  createJali,
  optional,
  row,
  type ActionResult,
  type DeepReadonly,
  type Jali,
  type JaliPage,
  type Layout,
  type NodeId,
  type ObjectRef,
  type Ref,
  type RefOf,
  type Toast,
} from "@jali/core";
import {
  JaliRoot,
  JaliView,
  Shelf,
  definePage,
  definePane,
  useJali,
  useJaliEvent,
  useJaliState,
  usePane,
} from "@jali/react";

// ---------- the quickstart ----------
const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params, openBeside }) => {
    expectTypeOf(params).toEqualTypeOf<{ id: number }>();
    return <button onClick={() => openBeside(note({ id: params.id + 1 }))}>Next</button>;
  },
});
const order = definePane("order", {
  params: { id: Number, tab: optional(String) },
  title: ({ id }) => `Order ${id}`,
  Component: () => null,
});
const launcher = definePane("launcher", {
  title: "New pane",
  scratch: true,
  Component: () => null,
});

const jali = createJali({
  panes: [note, order],
  launcher,
  layout: row(note({ id: 1 }), order({ id: 2 })),
});

type NoteRef = Ref<"note", { id: number }>;
type OrderRef = Ref<"order", { id: number; tab?: string }>;
type LauncherRef = Ref<"launcher", Record<string, string | number | boolean>>;
type Refs = NoteRef | OrderRef | LauncherRef;

describe("the quickstart", () => {
  it("a kind's call is a ref of that kind, with its params", () => {
    expectTypeOf(note({ id: 1 })).toEqualTypeOf<NoteRef>();
    expectTypeOf(order({ id: 1, tab: "lines" })).toEqualTypeOf<OrderRef>();
    expectTypeOf(note.kind).toEqualTypeOf<"note">();
    // A ref of a known kind is still an ObjectRef, for links and agents.
    expectTypeOf(note({ id: 1 })).toMatchTypeOf<ObjectRef>();
  });

  it("createJali returns a workspace typed by its kinds, without a page", () => {
    expectTypeOf(jali).toEqualTypeOf<Jali<Refs, undefined>>();
    expectTypeOf<RefOf<typeof note | typeof order>>().toEqualTypeOf<NoteRef | OrderRef>();
    expectTypeOf(jali.page).toEqualTypeOf<undefined>();
  });

  it("actions take refs of the kinds registered", () => {
    expectTypeOf(jali.actions.openBeside("p", order({ id: 7 }))).toEqualTypeOf<ActionResult>();
    jali.actions.openBeside(note({ id: 1 }), order({ id: 7 }), { edge: "bottom" });
    jali.actions.openBeside("p", { kind: "order", params: { id: 7 } });
    jali.actions.select("list", null);
  });

  it("events say which kind, with its params", () => {
    jali.on("open", ({ ref, pane }) => {
      expectTypeOf(pane).toEqualTypeOf<NodeId>();
      if (ref.kind === "order") {
        expectTypeOf(ref.params.id).toEqualTypeOf<number>();
        expectTypeOf(ref.params.tab).toEqualTypeOf<string | undefined>();
      }
    });
    jali.on("close", ({ ref }) => expectTypeOf(ref).toEqualTypeOf<Refs>());
    jali.on("toast", (toast) => expectTypeOf(toast).toMatchTypeOf<Toast>());
  });

  it("the model and the state are read-only, and typed by kind", () => {
    const model = jali.model();
    expectTypeOf(model.panes[0]!.ref).toEqualTypeOf<Refs>();
    expectTypeOf(model.pane("p")?.ref).toEqualTypeOf<Refs | undefined>();
    expectTypeOf(jali.get().selection["list"]?.ref).toEqualTypeOf<Refs | undefined>();
    expectTypeOf(jali.getLayout()).toEqualTypeOf<DeepReadonly<Layout>>();
    // What a workspace gave back can be given back.
    jali.setLayout(jali.getLayout());
  });

  it("refuses what is not a ref of its kinds", () => {
    // @ts-expect-error there is no kind "ordr"
    jali.actions.openBeside("p", { kind: "ordr", params: {} });
    // @ts-expect-error an order's id is a number
    jali.actions.openBeside("p", order({ id: "7" }));
    // @ts-expect-error an order's id is a number
    jali.actions.openHere("p", { kind: "order", params: { id: "7" } });
    // @ts-expect-error a note needs its id
    note({});
    // @ts-expect-error the page's actions are only there with a page
    jali.page.showView("summary");
    // @ts-expect-error the old name of `jali.dialogs.openPalette`
    jali.actions.openPalette();
    // @ts-expect-error a snapshot is read-only
    jali.get().layout.version = 1;
    // @ts-expect-error a snapshot is read-only
    jali.model().panes.push(jali.model().panes[0]!);
  });
});

// ---------- a curated page ----------
const borrower = definePane("borrower", {
  params: { app: Number },
  title: "Borrower",
  Component: () => null,
});
const review = definePage({
  id: "review",
  name: "Review",
  itemNoun: "application",
  roles: [{ id: "borrower", label: "Borrower", priority: "primary", icon: () => null }],
  home: "borrower",
  build: (app) => borrower({ app }),
  bind: (app) => ({ borrower: borrower({ app }) }),
  firstItem: 1,
  Header: () => null,
});
const reviewing = createJali({ panes: [borrower], page: review, linkMode: "peek" });

describe("a curated page", () => {
  it("has its actions, typed by its items", () => {
    expectTypeOf(reviewing.page).toEqualTypeOf<JaliPage<number>>();
    expectTypeOf(reviewing.page.showView("borrower")).toEqualTypeOf<ActionResult>();
    reviewing.page.showItem(4);
    reviewing.page.open({ item: 2, tab: "borrower" });
    reviewing.page.setMode("split");
    reviewing.page.setLinkMode("open");
    reviewing.page.back();
    reviewing.page.reset();
    reviewing.page.leave();
    reviewing.dialogs.openPalette();
    reviewing.dialogs.closeSettings();
  });

  it("refuses what the page doesn't take", () => {
    // @ts-expect-error the page's items are numbers
    reviewing.page.showItem("four");
    // @ts-expect-error a link opens beside, or only peeks
    reviewing.page.setLinkMode("investigate");
    // @ts-expect-error the old name of `jali.page.showView`
    reviewing.actions.openTab("borrower");
    // @ts-expect-error a borrower is the only kind here
    reviewing.actions.peek("borrower", note({ id: 1 }));
  });
});

// ---------- chrome of the app's own ----------
function OrderLines() {
  const { params, openHere } = usePane(order);
  expectTypeOf(params).toEqualTypeOf<{ id: number; tab?: string }>();
  expectTypeOf(openHere).parameter(0).toMatchTypeOf<ObjectRef>();
  return null;
}

function StatusLine() {
  const workspace = useJali<typeof jali>();
  expectTypeOf(workspace).toEqualTypeOf<typeof jali>();
  const focused = useJaliState<string | undefined, typeof jali>((s) => s.view.focused);
  expectTypeOf(focused).toEqualTypeOf<string | undefined>();
  useJaliEvent<"open", typeof jali>("open", ({ ref }) => {
    if (ref.kind === "note") expectTypeOf(ref.params.id).toEqualTypeOf<number>();
  });
  // @ts-expect-error no event "opened"
  useJaliEvent("opened", () => {});
  return <Shelf />;
}

describe("chrome of the app's own", () => {
  it("renders around <JaliView /> in the one root", () => {
    const app = (
      <JaliRoot jali={jali} overlays={null} settingsExtra={null}>
        <StatusLine />
        <JaliView />
        <OrderLines />
      </JaliRoot>
    );
    expectTypeOf(app).not.toBeAny();
    // A page's workspace renders in the same root.
    expectTypeOf(<JaliRoot jali={reviewing} />).not.toBeAny();
  });
});
