/**
 * The public face of a workspace: what `createJali` returns. It reads the state, runs the public actions, tells the
 * app what changed (`on`), and saves and restores the layout. Everything else about the store (raw writes, the
 * engine's steps, its DOM and ports) stays in `@jali/core/adapter`, reached with `storeOf(jali)`.
 */
import type { Layout, NodeId, ObjectRef } from "../layout/types";
import type { LayoutInput } from "../layout/build";
import type { Keymap } from "../commands/keymap";
import type { Env } from "../profile";
import type { Messages } from "./messages";
import { publicActions, type ActionName, type JaliActions } from "../actions/public";
import { restoreLayout } from "../actions/layout";
import type { ActionResult, Toast } from "./apply";
import type { JaliModel } from "./model";
import type { JaliInput } from "../dom/input";
import type { UiState, UiStore } from "./store";

/** What every event carries. */
export interface JaliEventBase {
  /** Where the change came from: a person's `mouse`, `touch`, `pen`, `keyboard` or `virtual` click, an `agent`, or the
   *  app's own `code`. For analytics, and to tell a person's change from your own; not to change what Jali does. */
  input: JaliInput;
}

/**
 * What a workspace tells the app, once per change and only once it is made (never for the steps inside one action).
 * In each change they come in this order: `close`, `open`, `pin`, `focus`, `layout`. Each carries `input`.
 */
export interface JaliEvents {
  /** A pane was added to the layout, or now shows another object (`previous`: what it showed before). */
  open: JaliEventBase & { pane: NodeId; ref: ObjectRef; previous?: ObjectRef };
  /** A pane left the layout. A pane that is tucked, folded or behind a tab is still in it. */
  close: JaliEventBase & { pane: NodeId; ref: ObjectRef };
  /** A pane's tab was pinned or unpinned, however: the tab menu, `setPinned`, `setLayout`, Back or a link. Not for a
   *  pane that arrives pinned (that is an `open`). */
  pin: JaliEventBase & { pane: NodeId; pinned: boolean };
  /** Another pane is focused (`pane` undefined: none). */
  focus: JaliEventBase & { pane: NodeId | undefined; previous: NodeId | undefined };
  /**
   * The layout changed: by an action, a gesture, a key or `setLayout` ("action"), or by Back, Forward or a link
   * ("address"). Fitting to a new window size is not a change. `action` names the action that made it, as
   * `jali.actions` names it (`"resetLayout"`, `"openBeside"`) or `"setLayout"`, whoever ran it: the app, or the person
   * from Jali's buttons, menus, keys or ⌘K. A change made after a question (Discard, or `beforeClose`'s later yes) names
   * the action that asked. Undefined for a change no action names: a drag, a divider, a linked pane following its list,
   * and anything from the address.
   */
  layout: JaliEventBase & { layout: Layout; source: "action" | "address"; action?: ActionName };
}

export type JaliEvent = keyof JaliEvents;

/** The state an app reads (`jali.get()`, `useJaliState`). The rest of the store's state is the engine's. */
export type JaliState = Pick<
  UiState,
  | "layout"
  | "page"
  | "view"
  | "presetId"
  | "peekSource"
  | "resizeMode"
  | "settings"
  | "activity"
  | "selection"
  | "recent"
  | "area"
  | "dir"
  | "unsaved"
  | "paletteOpen"
  | "settingsOpen"
>;

/** A workspace: `createJali(...)` returns one, `<JaliRoot jali>` renders it. */
export interface Jali {
  /** What an app can ask the workspace to do: `jali.actions.openBeside(pane, ref)`. */
  readonly actions: JaliActions;
  /** The state now. */
  get(): JaliState;
  /** Called after every change of state. Use `on` to hear what changed. */
  subscribe(fn: () => void): () => void;
  /** The workspace as it is on screen: panes, their boxes and titles, the shelf. */
  model(): JaliModel;
  /** Hear one kind of change (`jali.on("open", ({ pane, ref }) => …)`). Returns the unsubscribe. */
  on<E extends JaliEvent>(event: E, handler: (event: JaliEvents[E]) => void): () => void;
  /** The layout on screen, to save. `setLayout` and `createJali({ layout })` take it back. */
  getLayout(): Layout;
  /** Show a layout (anything `createJali({ layout })` takes), fitted to the room. Asks before losing work, as a
   *  close does. Back returns to the layout before. */
  setLayout(layout: LayoutInput): ActionResult;
  /** Keys and the commands they run. */
  readonly keymap: Keymap;
  /** The pane kinds, presets and curated page it was made with. */
  readonly env: Env;
  /** Every word it shows or says: English (`en`) with `createJali({ messages })` over it, for the app's own UI in
   *  the same language. */
  readonly messages: Messages;
  /** The address to share. */
  href(): string;
  /** Toasts to show (a close offers Undo). Toasts sent before anyone listens are kept until someone does. */
  onToast(fn: (toast: Toast) => void): () => void;
  /** Start its keys, Back and Forward, theme and saving; returns their stop. `<JaliRoot>` does this. */
  start(): () => void;
  /** Stop for good, when the workspace goes away (a route change, a test's end): its listeners stop, pane state
   *  waiting to be saved is saved, a follow waiting for the selection to rest and a pending address write are
   *  dropped, and nothing is scheduled after. Its state can still be read. Calling it again does nothing. */
  destroy(): void;
}

const stores = /* @__PURE__ */ new WeakMap<Jali, UiStore>();

/** The store behind a workspace, for adapters (`@jali/core/adapter`). */
export function storeOf(jali: Jali): UiStore {
  const store = stores.get(jali);
  if (!store) throw new Error("Jali: not a workspace made by createJali");
  return store;
}

export function createInstance(store: UiStore): Jali {
  const jali: Jali = {
    actions: Object.freeze(publicActions(store.apply)),
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
    onToast: store.onToast,
    start: () => store.start(),
    destroy: () => store.destroy(),
  };
  Object.freeze(jali);
  stores.set(jali, store);
  return jali;
}
