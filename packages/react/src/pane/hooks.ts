/**
 * Hooks for a pane's content. Each acts for the pane it is called in, from any depth inside it.
 *
 *   const { params, openBeside } = usePane<{ id: number }>();
 *   useActivity(query.isFetching ? "loading" : "idle");
 *   useUnsaved(draft !== saved && "an unsaved note");
 *   useCommands([{ id: "save", title: "Save note", run: save }]);
 *   useTitle(query.data?.name);
 *   usePaneAttributes({ "data-connection": connection.kind });
 */
import { useEffect, useMemo, useRef } from "react";
import type {
  ObjectRef,
  PaneActivity,
  PaneAttributes,
  PaneCommand,
  Params,
} from "@jali/core/adapter";
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
    const listed = latest.current.map((c) => ({
      ...c,
      run: () => latest.current.find((l) => l.id === c.id)?.run(),
    }));
    host.setCommands(listed.length ? listed : null);
  }, [host, shape]);
  useEffect(() => () => host.setCommands(null), [host]);
}

/**
 * Name the pane from its data ("Acme Ltd" rather than "Customer 12"): in its header, tab, the shelf, ⌘K, the switcher
 * and announcements, in place of the kind's `title`. `null` or `undefined` goes back to the kind's title. Cleared when
 * the component unmounts or the pane shows another object; not saved. The peek sheet keeps the kind's title.
 */
export function useTitle(title: string | null | undefined): void {
  const { host, props } = usePaneContext("useTitle");
  const text = title || null;
  // The workspace drops a title when the pane shows another object; this sets the new object's again.
  const shows = JSON.stringify(props.node.ref);
  useEffect(() => {
    host.setTitle(text);
  }, [host, text, shows]);
  useEffect(() => () => host.setTitle(null), [host]);
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
  const shape = attributes ? JSON.stringify(attributes) : null;
  const latest = useRef<PaneAttributes | null | undefined>(attributes);
  latest.current = attributes;
  // As with a title: the workspace drops them when the pane shows another object; this sets the new object's again.
  const shows = JSON.stringify(props.node.ref);
  useEffect(() => {
    host.setAttributes(shape ? (latest.current ?? null) : null);
  }, [host, shape, shows]);
  useEffect(() => () => host.setAttributes(null), [host]);
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
