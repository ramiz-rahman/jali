/**
 * The public face of an instance: what `createJali` returns. It reads the state, runs the public actions, tells the
 * app what changed (`on`), and saves and restores the layout. Everything else about the store (raw writes, the
 * engine's steps, its DOM and ports) stays in `@jali/core/adapter`, reached with `storeOf(jali)`.
 */
import type { DeepReadonly, Layout, NodeId, ObjectRef } from "../layout/types";

export type { DeepReadonly };
import type { LayoutInput } from "../layout/build";
import type { Keymap } from "../commands/keymap";
import type { Env } from "../env";
import type { Messages } from "./messages";
import type { ActionName, JaliActions, JaliDialogs, JaliPage } from "../actions/public";
import { bindSteps, isPublicStep } from "../actions";
import { restoreLayout } from "../actions/layout";
import type { ActionResult, Toast } from "./apply";
import type { JaliModel } from "./model";
import type { JaliInput } from "../dom/input";
import type { ProfileBase } from "../profile";
import type { Selection, UiState, JaliStore } from "./store";

/** What every event carries. */
export interface JaliEventBase {
  /** Where the change came from: a person's `mouse`, `touch`, `pen`, `keyboard` or `virtual` click, an `agent`, or the
   *  app's own `code`. For analytics, and to tell a person's change from your own; not to change what Jali does. */
  input: JaliInput;
}

/**
 * What an instance tells the app, once per change and only once it is made (never for the steps inside one action).
 * In each change they come in this order: `close`, `open`, `pin`, `focus`, `layout`. Each carries `input`. `R` is the
 * refs of the instance's kinds: `ref.kind` says which, and narrows its params.
 */
export interface JaliEvents<R extends ObjectRef = ObjectRef> {
  /** A pane was added to the layout, or now shows another object (`previous`: what it showed before). */
  open: JaliEventBase & { pane: NodeId; ref: R; previous?: R };
  /** A pane left the layout. A pane that is tucked, folded or behind a tab is still in it. */
  close: JaliEventBase & { pane: NodeId; ref: R };
  /** A pane's tab was pinned or unpinned, however: the tab menu, `setPinned`, `setLayout`, Back or a link. Not for a
   *  pane that arrives pinned (that is an `open`). */
  pin: JaliEventBase & { pane: NodeId; pinned: boolean };
  /** Another pane is focused (`pane` undefined: none). */
  focus: JaliEventBase & { pane: NodeId | undefined; previous: NodeId | undefined };
  /**
   * The layout changed: by an action, a gesture, a key or `setLayout` ("action"), or by Back, Forward or a link
   * ("address"). Fitting to a new window size is not a change. `action` names the action that made it, as the
   * instance names it (`"resetLayout"`, `"openBeside"`, `"page.showView"`) or `"setLayout"`, whoever ran it: the app,
   * or the person from Jali's buttons, menus, keys or ⌘K. A change made after a question (Discard, or
   * `beforeClose`'s later yes) names the action that asked. Undefined for a change no action names: a drag, a
   * divider, a linked pane following its list, and anything from the address.
   */
  layout: JaliEventBase & {
    layout: DeepReadonly<Layout>;
    source: "action" | "address";
    action?: ActionName;
  };
  /** A toast to show (a close offers Undo): Jali draws none of its own, so put a toaster in `<JaliRoot overlays>`.
   *  Toasts sent before anyone listens are kept until someone does. */
  toast: JaliEventBase & Toast;
}

export type JaliEvent = keyof JaliEvents;

/** The state an app reads (`jali.get()`, `useJaliState`), read-only. The rest of the store's state is the engine's. */
export type JaliState<R extends ObjectRef = ObjectRef> = DeepReadonly<
  Pick<
    UiState,
    | "layout"
    | "page"
    | "linkMode"
    | "view"
    | "presetId"
    | "peekSource"
    | "resizeMode"
    | "settings"
    | "activity"
    | "area"
    | "dir"
    | "unsaved"
    | "paletteOpen"
    | "settingsOpen"
  >
> & {
  /** Each list pane's selected item. */
  readonly selection: Readonly<Record<NodeId, Readonly<Selection<R>>>>;
  /** Objects opened this session, most recent first. */
  readonly recent: readonly R[];
};

/** The page's actions an instance has: `JaliPage` for the page's item type, or none. */
export type PageOf<P> = P extends ProfileBase<any, infer I> ? JaliPage<I> : undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * An instance: `createJali(...)` returns one, `<JaliRoot jali>` renders it. `R` is the refs of its kinds, which
 * `createJali` infers from `panes` (a ref of a kind it doesn't have is a type error); `P` is its curated page's
 * actions, or `undefined` without a page.
 */
export interface Jali<
  R extends ObjectRef = ObjectRef,
  P extends JaliPage<any> | undefined = JaliPage | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
> {
  /** What an app can ask the instance to do with panes and layouts: `jali.actions.openBeside(pane, ref)`. */
  readonly actions: JaliActions<R>;
  /** The curated page's actions (`jali.page.showView("summary")`): there only when `createJali({ page })` was given
   *  one. */
  readonly page: P;
  /** Jali's dialogs: the palette, settings and the chooser. */
  readonly dialogs: JaliDialogs;
  /** The state now, read-only. */
  get(): JaliState<R>;
  /** Called after every change of state. Use `on` to hear what changed. */
  subscribe(fn: () => void): () => void;
  /** The layout as it is on screen: panes, their boxes and titles, the shelf. Read-only. */
  model(): JaliModel<R>;
  /** Hear one kind of change (`jali.on("open", ({ pane, ref }) => …)`, `jali.on("toast", show)`). Returns the
   *  unsubscribe. */
  on<E extends JaliEvent>(event: E, handler: (event: JaliEvents<R>[E]) => void): () => void;
  /** The layout on screen, to save. `setLayout` and `createJali({ layout })` take it back. */
  getLayout(): DeepReadonly<Layout>;
  /** Show a layout (anything `createJali({ layout })` takes), fitted to the room. Asks before losing work, as a
   *  close does. Back returns to the layout before. */
  setLayout(layout: LayoutInput): ActionResult;
  /** Keys and the commands they run. Read-only. */
  readonly keymap: Keymap;
  /** The pane kinds, presets and curated page it was made with. Read-only. */
  readonly env: Env;
  /** Every word it shows or says: English (`en`) with `createJali({ messages })` over it, for the app's own UI in
   *  the same language. Read-only. */
  readonly messages: Messages;
  /** The address to share. */
  href(): string;
  /** Start its keys, Back and Forward, theme and saving; returns their stop, after which `start()` starts it again.
   *  `<JaliRoot>` does both. */
  start(): () => void;
  /** Stop for good, when the instance goes away (a route change, a test's end): its listeners stop, pane state
   *  waiting to be saved is saved, a drag in progress ends without a drop, a follow waiting for the selection to rest
   *  and a pending address write are dropped, and nothing is scheduled after. A question still open (`beforeClose`, or "Discard unsaved changes?")
   *  settles as `"kept"`, every action after it is refused as `"unavailable"`, and `start()` does nothing. Its state
   *  can still be read. Calling it again does nothing. */
  destroy(): void;
}

/** Any instance, whatever its kinds and page. */
export type AnyJali = Jali<any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * One declaration types the app's instance everywhere, React's hooks included, as TanStack Router does:
 *
 *   declare module "@jali/core" {
 *     interface Register {
 *       jali: typeof jali;
 *     }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Register {}

/** The app's instance type, from `Register`; any instance when nothing is registered. */
export type RegisteredJali = Register extends { jali: infer J extends AnyJali } ? J : Jali;

/** The refs of an instance's kinds. */
export type RefsOf<J extends AnyJali> = J extends Jali<infer R, any> ? R : ObjectRef; // eslint-disable-line @typescript-eslint/no-explicit-any

const stores = /* @__PURE__ */ new WeakMap<AnyJali, JaliStore>();

/** The store behind an instance, for adapters (`@jali/core/adapter`). */
export function storeOf(jali: AnyJali): JaliStore {
  const store = stores.get(jali);
  if (!store) throw new Error("Jali: not an instance made by createJali");
  return store;
}

/** The public steps of one group (`""`: `jali.actions`; `"page"`, `"dialogs"`), each through the store's `run`. */
const group = (store: JaliStore, prefix: string) =>
  bindSteps(store.run, (name) => {
    if (!isPublicStep(name)) return undefined;
    const dot = name.indexOf(".");
    const [g, n] = dot < 0 ? ["", name] : [name.slice(0, dot), name.slice(dot + 1)];
    return g === prefix ? n : undefined;
  });

export function createInstance(store: JaliStore): Jali {
  const jali: Jali = {
    actions: group(store, "") as unknown as JaliActions,
    // Only with a page: without one there is no `page` at all.
    ...((store.env.page ? { page: group(store, "page") } : {}) as unknown as { page: JaliPage }),
    dialogs: group(store, "dialogs") as unknown as JaliDialogs,
    get: store.get,
    subscribe: store.subscribe,
    model: store.model,
    on: store.on,
    getLayout: () => store.get().layout,
    setLayout: (layout) => store.apply((x) => restoreLayout(x, layout), "setLayout"),
    keymap: store.keymap,
    env: store.env,
    messages: store.messages,
    href: store.href,
    start: () => store.start(),
    destroy: () => store.destroy(),
  };
  Object.freeze(jali);
  stores.set(jali, store);
  return jali;
}
