/**
 * `jali/testing`: what an app's own tests need, without reaching into the adapter's internals.
 *
 *   const { jali, location } = createTestJali({ panes, presets, features: [chooser()] });
 *   // or, for an app that makes its workspace in a function of its own:
 *   const { options, location } = testJaliOptions({ search: "?l=…" });
 *   const jali = createMyJali(services, options);
 *   reportUnsaved(jali, "order", "an unsaved note");
 *   expect(jali.actions.close("order").reason).toBe("unsaved");
 *   answerDiscard(jali, "discard");
 *
 * A test workspace is kept apart from the page and from other tests: its address is in memory (`location`), so is
 * what it saves, it has a size (nothing measures a window in a test), and it moves no DOM focus.
 */
import { createJali, type JaliOptions } from "./create-jali";
import type { PaneKindBase, RefOf } from "./pane-kinds";
import type { ProfileBase } from "./profile";
import { memoryLocation, memoryStorage } from "./ports";
import { urlSync } from "./features/url-sync";
import { storeOf, type AnyJali, type Jali, type PageOf } from "./state/instance";
import type { NodeId } from "./layout/types";
import type { ChooseOptions } from "./actions/choose";
import type { ActionResult } from "./state/apply";
import { parseKeys, type Platform } from "./commands/format";
import { paneStateFor } from "./state/pane-state";

export interface TestJaliOptions<
  D extends PaneKindBase,
  L extends PaneKindBase,
  P extends ProfileBase<any, any> | null | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
> extends JaliOptions<D, L, P> {
  /** The address the workspace opens on, as a link would (`"?l=…"`). Default: none. */
  search?: string;
}

/** An address in memory, as a test's workspace has it: it records `entries`, and `visit` changes it as Back or a
 *  router link would. */
export type TestLocation = ReturnType<typeof memoryLocation>;

/**
 * The options that keep a workspace apart in a test, for an app that makes its workspace in a function of its own
 * (`createMyJali(services, options)`): its address in memory (`location`), storage in memory, a size of 1440×900
 * unless `size` says otherwise, keys as on a Mac (`keyboard.platform`, so `pressKeys` means the same keys on every
 * machine) and no DOM focus. `options.features` holds only `urlSync` with the memory address: the app's function
 * puts its own features before it, and this one takes the place of the app's `urlSync()`.
 */
export function testJaliOptions({
  search = "",
  size = { width: 1440, height: 900 },
}: { search?: string; size?: { width: number; height: number } } = {}) {
  const location = memoryLocation(search);
  return {
    location,
    options: {
      storage: memoryStorage(),
      size,
      moveFocus: false,
      keyboard: { platform: "mac" as const },
      features: [urlSync({ location })],
    } satisfies Partial<JaliOptions>,
  };
}

/** A workspace for a test: `createJali` with `testJaliOptions` under your options, and its address always in memory
 *  (after your features). */
export function createTestJali<
  const D extends PaneKindBase,
  const L extends PaneKindBase = never,
  const P extends ProfileBase<any, any> | null | undefined = undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
>({
  search,
  ...options
}: TestJaliOptions<D, L, P>): { jali: Jali<RefOf<D | L>, PageOf<P>>; location: TestLocation } {
  const test = testJaliOptions({ search, ...(options.size ? { size: options.size } : {}) });
  const jali = createJali<D, L, P>({
    ...test.options,
    ...options,
    keyboard: { ...test.options.keyboard, ...options.keyboard },
    features: [...(options.features ?? []), ...test.options.features],
  });
  return { jali, location: test.location };
}

/** What a rendered pane's `useUnsaved` reports: `what` is unsaved in pane `pane` (`null`: nothing is). */
export const reportUnsaved = (jali: AnyJali, pane: NodeId, what: string | null): ActionResult =>
  storeOf(jali).actions.setUnsaved(pane, what);

/** What a rendered pane's `usePaneState` keeps: `value` under `key`, for the object pane `pane` shows. */
export const reportPaneState = (
  jali: AnyJali,
  pane: NodeId,
  key: string,
  value: unknown,
): ActionResult => storeOf(jali).actions.setPaneState(pane, key, value);

/** Pane `pane`'s own state (`usePaneState`), for the object it shows now; undefined when it has none. */
export function paneStateOf(jali: AnyJali, pane: NodeId): Record<string, unknown> | undefined {
  const store = storeOf(jali);
  const node = store.model().pane(pane);
  return node ? paneStateFor(store.get(), store.env.kinds, pane, node.ref) : undefined;
}

/** "Discard unsaved changes?", while it is asked: the panes that would lose work. Null when nothing is asked. */
export const discardQuestion = (jali: AnyJali): { panes: readonly NodeId[] } | null => {
  const c = storeOf(jali).get().confirm;
  return c ? { panes: c.panes } : null;
};

/** Answer "Discard unsaved changes?" as the person would: Discard makes the change it held, Keep editing doesn't. */
export const answerDiscard = (jali: AnyJali, answer: "discard" | "keep"): ActionResult =>
  answer === "discard"
    ? storeOf(jali).actions.discardAndContinue()
    : storeOf(jali).actions.keepEditing();

/** What `jali.dialogs.choose` is asking the person now (the `chooser()` feature's dialog), or null. */
export const chooserRequest = (jali: AnyJali): ChooseOptions<unknown> | null => {
  const c = storeOf(jali).get().chooser;
  return c?.kind === "choose" ? c.request : null;
};

/** The last thing the workspace said to assistive technology (its live region's text). */
export const lastAnnouncement = (jali: AnyJali): string => storeOf(jali).get().announcement.text;

/**
 * Press keys, as a person would: `"Mod+K Mod+W"` is ⌘K then ⌘W on a Mac (`platform: "mac"`, the default) and
 * Ctrl+K then Ctrl+W elsewhere. Each step is a `keydown` dispatched at `target` (default: the focused element, else
 * the body), which a started workspace hears. Returns whether the last one was taken (`defaultPrevented`).
 */
export function pressKeys(
  keys: string,
  { target, platform = "mac" }: { target?: EventTarget; platform?: Platform } = {},
): boolean {
  let last: KeyboardEvent | undefined;
  for (const c of parseKeys(keys)) {
    const code = /^(Key|Digit)|^Backslash$|^Bracket/.test(c.key) ? c.key : undefined;
    const key = code
      ? code === "Backslash"
        ? "\\"
        : code === "BracketLeft"
          ? "["
          : code === "BracketRight"
            ? "]"
            : code.replace(/^(Key|Digit)/, "").toLowerCase()
      : c.key;
    const mac = platform === "mac";
    last = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
      ...(code ? { code } : {}),
      shiftKey: !!c.shift,
      altKey: !!c.alt,
      metaKey: mac && !!c.mod,
      ctrlKey: mac ? !!c.ctrl : !!(c.mod || c.ctrl),
    });
    (target ?? document.activeElement ?? document.body).dispatchEvent(last);
  }
  return !!last?.defaultPrevented;
}
