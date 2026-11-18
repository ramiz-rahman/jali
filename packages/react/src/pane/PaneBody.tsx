import { memo, useMemo } from "react";
import type { NodeId, ObjectRef, PaneNode, Actions, PaneActivity, PaneCommand, UiStore } from "@jali/core/adapter";
import { keyHint } from "@jali/core/adapter";
import type { PaneProps } from "../define";
import { PaneContext, type PaneHost } from "./context";
import { useEnv } from "../state/react";

export type { PaneHost };

export const paneHost = (actions: Actions, id: NodeId): PaneHost => ({
  openBeside: (ref) => actions.openBeside(id, ref),
  peek: (ref) => actions.peek(ref, id),
  select: (ref, opts) => actions.select(id, ref, opts),
  openHere: (ref) => actions.openHere(id, ref),
  dismiss: () => actions.dismiss(id),
  setActivity: (a: PaneActivity) => actions.setActivity(id, a),
  setUnsaved: (what: string | null) => actions.setUnsaved(id, what),
  setCommands: (commands: PaneCommand[] | null) => actions.setPaneCommands(id, commands),
});

/** The peek sheet acts for the pane it came from, and has no place of its own to fill, close or report on. */
export function peekHost(store: UiStore): PaneHost {
  const source = () => store.get().peekSource ?? store.get().view.focused ?? "";
  const none = () => {};
  return {
    openBeside: (ref: ObjectRef) => store.actions.openBeside(source(), ref),
    peek: (ref: ObjectRef | null) => store.actions.peek(ref, source()),
    select: (ref: ObjectRef | null) => store.actions.select(source(), ref),
    openHere: none, dismiss: none, setActivity: none, setUnsaved: none, setCommands: none,
  };
}

interface BodyProps { node: PaneNode; host: PaneHost; paused: boolean; focused: boolean; inPeek?: boolean }

/** The pane's content. Memoised on what the kind actually sees, so divider drags don't re-render content. */
export const PaneBody = memo(
  function PaneBody({ node, host, paused, focused, inPeek = false }: BodyProps) {
    const { kinds } = useEnv();
    const def = kinds.get(node.ref.kind);
    const params = useMemo(() => kinds.params(node.ref), [kinds, node.ref]);
    const props = useMemo((): PaneProps => ({
      params, node, paused, focused, inPeek,
      openBeside: host.openBeside, openHere: host.openHere, peek: host.peek, select: host.select, dismiss: host.dismiss,
    }), [params, node, paused, focused, inPeek, host]);
    // The peek sheet shows a node that is not in the layout: it has no state of its own to keep.
    const context = useMemo(() => ({ id: inPeek ? null : node.id, host, props }), [inPeek, node.id, host, props]);
    if (!def) {
      return (
        <div className="jali-pane-missing" role="alert">
          <strong>Unknown pane kind “{node.ref.kind}”.</strong>
          <span>This pane stays in place so the layout keeps its shape. Close it or reset the layout from the command palette ({keyHint("Mod+K")}).</span>
        </div>
      );
    }
    const C = def.Component;
    return (
      <PaneContext.Provider value={context}>
        <C {...props} />
      </PaneContext.Provider>
    );
  },
  (a, b) =>
    a.host === b.host && a.node.id === b.node.id && a.paused === b.paused && a.focused === b.focused &&
    a.node.linkedTo === b.node.linkedTo && a.node.pinned === b.node.pinned && JSON.stringify(a.node.ref) === JSON.stringify(b.node.ref),
);
