import { memo, useMemo } from "react";
import type {
  NodeId,
  ObjectRef,
  PaneNode,
  Actions,
  PaneActivity,
  PaneCommand,
  UiStore,
} from "@jali/core/adapter";
import { parseKeys } from "@jali/core/adapter";
import type { PaneProps } from "../define";
import { PaneContext, type PaneHost } from "./context";
import { useEnv, useStore } from "../state/react";
import { DefaultLoading, PaneBoundary } from "./PaneBoundary";

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
  setTitle: (title: string | null) => actions.setTitle(id, title),
  setAttributes: (attributes) => actions.setPaneAttributes(id, attributes),
});

/** The peek sheet acts for the pane it came from, and has no place of its own to fill, close or report on. */
export function peekHost(store: UiStore): PaneHost {
  const source = () => store.get().peekSource ?? store.get().view.focused ?? "";
  const none = () => {};
  return {
    openBeside: (ref: ObjectRef) => store.actions.openBeside(source(), ref),
    peek: (ref: ObjectRef | null) => store.actions.peek(ref, source()),
    select: (ref: ObjectRef | null) => store.actions.select(source(), ref),
    openHere: none,
    dismiss: none,
    setActivity: none,
    setUnsaved: none,
    setCommands: none,
    setTitle: none,
    setAttributes: none,
  };
}

interface BodyProps {
  node: PaneNode;
  host: PaneHost;
  paused: boolean;
  focused: boolean;
  inPeek?: boolean;
}

/** The pane's content. Memoised on what the kind actually sees, so divider drags don't re-render content. */
export const PaneBody = memo(
  function PaneBody({ node, host, paused, focused, inPeek = false }: BodyProps) {
    const store = useStore();
    const { kinds } = useEnv();
    const { keymap, messages } = useStore();
    const def = kinds.get(node.ref.kind);
    const params = useMemo(() => kinds.params(node.ref), [kinds, node.ref]);
    const props = useMemo(
      (): PaneProps => ({
        params,
        node,
        paused,
        focused,
        inPeek,
        openBeside: host.openBeside,
        openHere: host.openHere,
        peek: host.peek,
        select: host.select,
        dismiss: host.dismiss,
      }),
      [params, node, paused, focused, inPeek, host],
    );
    // The peek sheet shows a node that is not in the layout: it has no state of its own to keep.
    const context = useMemo(
      () => ({ id: inPeek ? null : node.id, host, props }),
      [inPeek, node.id, host, props],
    );
    if (!def) {
      return (
        <div className="jali-pane-missing" role="alert">
          <strong>{messages.pane.unknownKind(node.ref.kind)}</strong>
          <span>{messages.pane.unknownKindHelp(keymap.format(parseKeys("Mod+K")))}</span>
        </div>
      );
    }
    // A ref its kind can't read (a required param missing, a value of the wrong type) never reaches the component.
    const problems = kinds.problems(node.ref);
    if (problems.length) {
      return (
        <div className="jali-pane-missing" role="alert">
          <strong>{messages.pane.cantOpen(node.ref.kind)}</strong>
          <span>{messages.pane.cantOpenHelp(problems)}</span>
        </div>
      );
    }
    const C = def.Component;
    const Loading = def.Loading;
    return (
      <PaneContext.Provider value={context}>
        <PaneBoundary
          resetKey={JSON.stringify(node.ref)}
          host={host}
          name={kinds.title(node.ref)}
          close={() => (inPeek ? store.actions.peek(null) : store.actions.close(node.id))}
          onError={(error) =>
            store.env.onPaneError?.(error, { pane: inPeek ? null : node.id, ref: node.ref })
          }
          loading={Loading ? <Loading {...props} /> : <DefaultLoading />}
        >
          <C {...props} />
        </PaneBoundary>
      </PaneContext.Provider>
    );
  },
  (a, b) =>
    a.host === b.host &&
    a.node.id === b.node.id &&
    a.paused === b.paused &&
    a.focused === b.focused &&
    a.node.linkedTo === b.node.linkedTo &&
    a.node.pinned === b.node.pinned &&
    JSON.stringify(a.node.ref) === JSON.stringify(b.node.ref),
);
