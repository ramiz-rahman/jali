/**
 * Hooks for a pane's content. Each acts for the pane it is called in, from any depth inside it.
 *
 *   const { params, openBeside } = usePane<{ id: number }>();
 *   useActivity(query.isFetching ? "loading" : "idle");
 *   useUnsaved(draft !== saved && "an unsaved note");
 *   useCommands([{ id: "save", title: "Save note", run: save }]);
 */
import { useEffect, useMemo, useRef } from "react";
import type { ObjectRef, PaneActivity, PaneCommand, Params } from "@jali/core/adapter";
import { openPaneFor } from "@jali/core/adapter";
import type { PaneProps } from "../define";
import { useModel, useUi } from "../state/react";
import { usePaneContext } from "./context";

/** The pane's props, for components below the kind's own. */
export function usePane<P = Params>(): PaneProps<P> {
  return usePaneContext("usePane").props as PaneProps<P>;
}

/** Report what the pane is doing, for its header, tab, the shelf and the status line. `undefined` reports nothing. */
export function useActivity(activity: PaneActivity | undefined): void {
  const { host } = usePaneContext("useActivity");
  useEffect(() => {
    if (activity) host.setActivity(activity);
  }, [host, activity]);
}

/**
 * Report unsaved work, in words ("an unsaved note"); `null` or `false` once it is saved. While a pane has some,
 * nothing closes it or replaces what it shows without asking the person first.
 */
export function useUnsaved(what: string | null | false | undefined): void {
  const { host } = usePaneContext("useUnsaved");
  const text = what || null;
  useEffect(() => host.setUnsaved(text), [host, text]);
  useEffect(() => () => host.setUnsaved(null), [host]);
}

/**
 * The commands this pane adds to ⌘K while it is focused. Pass them on every render: they are listed again only when
 * an id, title, keys or disabled reason changes, and each runs the latest `run` it was given.
 */
export function useCommands(commands: readonly PaneCommand[]): void {
  const { host } = usePaneContext("useCommands");
  const latest = useRef(commands);
  latest.current = commands;
  const shape = JSON.stringify(commands.map(({ run: _run, ...rest }) => rest));
  useEffect(() => {
    const listed = latest.current.map((c) => ({ ...c, run: () => latest.current.find((l) => l.id === c.id)?.run() }));
    host.setCommands(listed.length ? listed : null);
  }, [host, shape]);
  useEffect(() => () => host.setCommands(null), [host]);
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
    () => ({ recent, isOpen: (ref: ObjectRef) => !!openPaneFor(m, ref, id ?? undefined), titleOf: m.env.kinds.title }),
    [recent, m, id],
  );
}
