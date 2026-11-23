/**
 * Hooks for a pane's content. Each acts for the pane it is called in, from any depth inside it.
 *
 *   const { params, openBeside } = usePane(note); // params: { id: number }
 *   useActivity(query.isFetching ? "loading" : "idle");
 *   useUnsaved(draft !== saved && "an unsaved note");
 *   useCommands([{ id: "save", title: "Save note", run: save }]);
 *   useTitle(query.data?.name);
 *   usePaneAttributes({ "data-connection": connection.kind });
 *   useHeaderActions(<button onClick={add}>Add</button>);
 *
 * Any number of components in a pane may call the reporting hooks: each call is reported on its own and the instance
 * merges them. Commands are listed in render order (a parent's before its children's); the pane has unsaved work while
 * any call reports some; its activity is the most pressing reported; its title and attributes are the innermost
 * call's (on a first mount; after that, the latest mounted). A call that unmounts takes only its own report away.
 */
import type { ObjectRef, PaneActivity, PaneCommand, Params } from "@jali/core";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PaneReportPatch } from "@jali/core/adapter";
import type { PaneHost } from "./context";
import { openPaneFor, sameRef } from "@jali/core/adapter";
import type { Pane, PaneProps, ParamsOfPane } from "../define";
import { shallow, useKept, useModel, useUi } from "../state/react";
import { usePaneContext } from "./context";

// Development checks test the literal, so a production build drops them and their messages (dev.ts).
declare const process: { env: { NODE_ENV?: string } };

/**
 * The pane's props, for components below the kind's own. Give the kind (`usePane(order)`) and its params are typed
 * from it, with no cast; in development, a component in a pane of another kind is an error. Without a kind, the
 * params are plain values (`Params`), for a component that any kind renders.
 */
export function usePane(): PaneProps<Params>;
export function usePane<D extends Pane>(kind: D): PaneProps<ParamsOfPane<D>>;
export function usePane(kind?: Pane): PaneProps<Params> {
  const props = usePaneContext("usePane").props;
  try {
    if (process.env.NODE_ENV !== "production" && kind && props.node.ref.kind !== kind.kind)
      console.error(
        `Jali: usePane(${kind.kind}) is called in a pane of kind "${props.node.ref.kind}", so its params are not a ${kind.kind}'s`,
      );
  } catch {
    /* no `process`: production */
  }
  return props;
}

/** Render order across every pane: a parent renders (and so mounts) before its children. */
let order = 0;
/** This call's place in render order, from its mount: later for a child than its parent, and for a later mount. */
const useOrder = () => useState(() => ++order)[0];

/** This hook call's report to `host`, kept apart from every other call's in the pane. Stable while `host` is. */
export function useReporter(host: PaneHost): (patch: PaneReportPatch | null) => void {
  const caller = useId();
  const seq = useOrder();
  return useCallback(
    (patch: PaneReportPatch | null) => host.report(caller, seq, patch),
    [host, caller, seq],
  );
}

/**
 * Report what the pane is doing, for its header, tab, the shelf and the status line. `undefined` clears it (the same
 * as `"idle"`: nothing is shown), as does the component unmounting.
 */
export function useActivity(activity: PaneActivity | undefined): void {
  const { host } = usePaneContext("useActivity");
  const report = useReporter(host);
  const now = activity && activity !== "idle" ? activity : null;
  useEffect(() => report({ activity: now }), [report, now]);
  useEffect(() => () => report(null), [report]);
}

/**
 * Report unsaved work, in words ("an unsaved note"); `null` or `false` once it is saved. While a pane has some,
 * nothing closes it or replaces what it shows without asking the person first.
 */
export function useUnsaved(what: string | null | false | undefined): void {
  const { host } = usePaneContext("useUnsaved");
  const report = useReporter(host);
  const text = what || null;
  useEffect(() => report({ unsaved: text }), [report, text]);
  useEffect(() => () => report(null), [report]);
}

/** The same commands as ⌘K lists them: ids, titles, keys and whether each is disabled, in order. */
const sameCommands = (a: readonly PaneCommand[], b: readonly PaneCommand[]) =>
  a.length === b.length &&
  a.every(
    (c, i) =>
      c.id === b[i]!.id &&
      c.title === b[i]!.title &&
      c.keys === b[i]!.keys &&
      c.disabled === b[i]!.disabled,
  );

/**
 * The commands this pane adds to ⌘K while it is focused. Pass them on every render: they are listed again only when
 * an id, title, keys or disabled reason changes, and each runs the latest `run` it was given.
 */
export function useCommands(commands: readonly PaneCommand[]): void {
  const { host } = usePaneContext("useCommands");
  const report = useReporter(host);
  const latest = useRef(commands);
  latest.current = commands;
  // Listed again when what ⌘K shows of them changes; a new `run` is read when one runs.
  const shape = useKept(commands, sameCommands);
  useEffect(() => {
    const listed = latest.current.map((c) => ({
      ...c,
      run: () => latest.current.find((l) => l.id === c.id)?.run(),
    }));
    report({ commands: listed.length ? listed : null });
  }, [report, shape]);
  useEffect(() => () => report(null), [report]);
}

/**
 * Name the pane from its data ("Acme Ltd" rather than "Customer 12"): in its header, tab, the shelf, ⌘K, the switcher
 * and announcements, in place of the kind's `title`. `null` or `undefined` goes back to the kind's title. Cleared when
 * the component unmounts or the pane shows another object; not saved. In the peek sheet it names the sheet, for the
 * object it shows; a sheet whose content gives none takes the name of a pane showing the same object, else the kind's.
 */
export function useTitle(title: string | null | undefined): void {
  const { host, props } = usePaneContext("useTitle");
  const report = useReporter(host);
  const text = title || null;
  // The instance drops a title when the pane shows another object; this sets the new object's again.
  const shows = useKept(props.node.ref, sameRef);
  useEffect(() => {
    report({ title: text });
  }, [report, text, shows]);
  useEffect(() => () => report(null), [report]);
}

/**
 * Mark the pane from its data with `data-*` attributes (`{ "data-connection": "production" }`), so your styles can
 * tell it apart. Jali puts them on everything that stands for the pane: its section, its tab in any strip, its shelf
 * chip, its entry in the pane switcher and the tab and shelf menus, and the peek sheet while it shows the pane's
 * object. Jali gives them no style. `null` or `undefined` clears them; they are also cleared when the component
 * unmounts or the pane shows another object, and they are not saved. Jali's own `data-*` attributes win over yours.
 */
export function usePaneAttributes(
  attributes: Record<`data-${string}`, string> | null | undefined,
): void {
  const { host, props } = usePaneContext("usePaneAttributes");
  const report = useReporter(host);
  const shape = useKept(attributes ?? null, shallow);
  // As with a title: the instance drops them when the pane shows another object; this sets the new object's again.
  const shows = useKept(props.node.ref, sameRef);
  useEffect(() => {
    report({ attributes: shape });
  }, [report, shape, shows]);
  useEffect(() => () => report(null), [report]);
}

/**
 * Put the pane's own controls in its header: after the title (and Following / Kept), before Jali's buttons. Pass them on
 * every render, like any JSX; `null` takes them away, as does the component unmounting. One set shows per pane, chosen
 * as a title is: of calls mounted together, the innermost call's; after that, the latest mounted call's that has
 * controls. When it unmounts, the one before it shows again. They render inside the pane's context, so the pane's hooks
 * work in them, as do providers above `<JaliRoot>`; a provider inside your component doesn't reach them.
 *
 * A narrow header gives way before its title gets shorter than a few characters: first Jali's tuck, maximise, full
 * screen and pop out move into the pane's menu (⋯), then your controls are hidden too and the menu lists the pane's
 * commands (useCommands) in their place. So give each control a command as well. The peek sheet has no header: there
 * the controls aren't shown.
 */
export function useHeaderActions(controls: ReactNode): void {
  const { header } = usePaneContext("useHeaderActions");
  const seq = useOrder();
  // Before paint, so the header never shows a frame without them.
  useLayoutEffect(() => {
    header?.set(seq, controls);
  });
  useLayoutEffect(() => () => header?.release(seq), [header, seq]);
}

/** What a launcher chooses from: the objects opened recently, whether one is open now, and its title. */
export interface LauncherSources {
  recent: ObjectRef[];
  isOpen: (ref: ObjectRef) => boolean;
  titleOf: (ref: ObjectRef) => string;
}

/** For the instance's launcher: Recent, what is open, and titles. */
export function useLauncher(): LauncherSources {
  const { id } = usePaneContext("useLauncher");
  const recent = useUi((s) => s.recent);
  const m = useModel();
  return useMemo(
    () => ({
      recent,
      isOpen: (ref: ObjectRef) => !!openPaneFor(m, ref, id ?? undefined),
      titleOf: m.env.kinds.title,
    }),
    [recent, m, id],
  );
}
