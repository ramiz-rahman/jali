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
 * Any number of components in a pane may call the reporting hooks: each call is reported on its own and the workspace
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
import type { PaneAttributes, PaneReportPatch } from "@jali/core/adapter";
import type { PaneHost } from "./context";
import { openPaneFor } from "@jali/core/adapter";
import type { Pane, PaneProps, ParamsOfPane } from "../define";
import { DEV } from "../dev";
import { useModel, useUi } from "../state/react";
import { usePaneContext } from "./context";

/**
 * The pane's props, for components below the kind's own. Give the kind (`usePane(order)`) and its params are typed
 * from it, with no cast; in development, a component in a pane of another kind is an error. Without a kind, the
 * params are plain values (`Params`), for a component that any kind renders.
 */
export function usePane(): PaneProps<Params>;
export function usePane<D extends Pane>(kind: D): PaneProps<ParamsOfPane<D>>;
export function usePane(kind?: Pane): PaneProps<Params> {
  const props = usePaneContext("usePane").props;
  if (DEV && kind && props.node.ref.kind !== kind.kind)
    console.error(
      `Jali: usePane(${kind.kind}) is called in a pane of kind "${props.node.ref.kind}", so its params are not a ${kind.kind}'s`,
    );
  return props;
}

/** Render order across every pane: a parent renders (and so mounts) before its children. */
let order = 0;

/** This hook call's report to `host`, kept apart from every other call's in the pane. Stable while `host` is. */
export function useReporter(host: PaneHost): (patch: PaneReportPatch | null) => void {
  const caller = useId();
  const [seq] = useState(() => ++order);
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

/**
 * The commands this pane adds to ⌘K while it is focused. Pass them on every render: they are listed again only when
 * an id, title, keys or disabled reason changes, and each runs the latest `run` it was given.
 */
export function useCommands(commands: readonly PaneCommand[]): void {
  const { host } = usePaneContext("useCommands");
  const report = useReporter(host);
  const latest = useRef(commands);
  latest.current = commands;
  const shape = JSON.stringify(commands.map(({ run: _run, ...rest }) => rest));
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
  // The workspace drops a title when the pane shows another object; this sets the new object's again.
  const shows = JSON.stringify(props.node.ref);
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
  const shape = attributes ? JSON.stringify(attributes) : null;
  const latest = useRef<PaneAttributes | null | undefined>(attributes);
  latest.current = attributes;
  // As with a title: the workspace drops them when the pane shows another object; this sets the new object's again.
  const shows = JSON.stringify(props.node.ref);
  useEffect(() => {
    report({ attributes: shape ? (latest.current ?? null) : null });
  }, [report, shape, shows]);
  useEffect(() => () => report(null), [report]);
}

/**
 * Put the pane's own controls in its header: after the title (and Following / Kept), before Jali's buttons. Pass them on
 * every render, like any JSX; `null` takes them away, as does the component unmounting. One set per pane: the last
 * call wins. They render inside the pane's context, so the pane's hooks work in them, as do providers above
 * `<JaliRoot>`; a provider inside your component doesn't reach them.
 *
 * A narrow header gives way before its title gets shorter than a few characters: first Jali's tuck, maximise, full
 * screen and pop out move into the pane's menu (⋯), then your controls are hidden too and the menu lists the pane's
 * commands (useCommands) in their place. So give each control a command as well. The peek sheet has no header: there
 * the controls aren't shown.
 */
export function useHeaderActions(controls: ReactNode): void {
  const { header } = usePaneContext("useHeaderActions");
  // Before paint, so the header never shows a frame without them.
  useLayoutEffect(() => {
    header?.set(controls);
  });
  useLayoutEffect(() => () => header?.set(null), [header]);
}

/** What a launcher chooses from: the objects opened recently, whether one is open now, and its title. */
export interface LauncherSources {
  recent: ObjectRef[];
  isOpen: (ref: ObjectRef) => boolean;
  titleOf: (ref: ObjectRef) => string;
}

/** For the workspace's launcher: Recent, what is open, and titles. */
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
