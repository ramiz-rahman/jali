import type { NodeId, ObjectRef, PaneNode, PaneActivity, PaneCommand } from "@jali/core";
import { memo, useMemo } from "react";
import type { ActionResult, UiStore } from "@jali/core/adapter";
import { parseKeys, sameRef } from "@jali/core/adapter";
import type { PaneProps } from "../define";
import { PaneContext, type PaneHost } from "./context";
import { useEnv, useMessages, useStore } from "../state/react";
import { useKeymap } from "../state/hydrated";
import { paneHydration } from "../state/hydration";
import { DefaultLoading, PaneBoundary } from "./PaneBoundary";
import { HeaderControls, type HeaderSlot } from "./header";

export type { PaneHost };

/** What pane `id`'s content can ask. Opening, peeking and selecting are `jali.actions`, so they return its result. */
export function paneHost(store: UiStore, id: NodeId): PaneHost {
  const { actions } = store,
    app = store.jali.actions;
  return {
    openBeside: (ref, options) => app.openBeside(id, ref, options),
    peek: (ref) => (ref ? app.peek(id, ref) : app.closePeek()),
    select: (ref, opts) => app.select(id, ref, opts),
    openHere: (ref) => app.openHere(id, ref),
    dismiss: () => actions.dismiss(id),
    setActivity: (a: PaneActivity) => actions.setActivity(id, a),
    setUnsaved: (what: string | null) => actions.setUnsaved(id, what),
    setCommands: (commands: PaneCommand[] | null) => actions.setPaneCommands(id, commands),
    setTitle: (title: string | null) => actions.setTitle(id, title),
    setAttributes: (attributes) => actions.setPaneAttributes(id, attributes),
    report: (caller, seq, patch) => actions.reportPane(id, caller, seq, patch),
  };
}

/** The peek sheet has no pane of its own to show something else in. */
const noPlace: ActionResult = { ok: false, reason: "unavailable" };

/** The peek sheet acts for the pane it came from, and has no place of its own to fill, close or report on. */
export function peekHost(store: UiStore): PaneHost {
  const source = () => store.get().peekSource ?? store.get().view.focused ?? "";
  const none = () => {};
  const app = store.jali.actions;
  return {
    openBeside: (ref, options) => app.openBeside(source(), ref, options),
    peek: (ref: ObjectRef | null) => (ref ? app.peek(source(), ref) : app.closePeek()),
    select: (ref: ObjectRef | null) => app.select(source(), ref),
    openHere: () => noPlace,
    dismiss: none,
    setActivity: none,
    setUnsaved: none,
    setCommands: none,
    setTitle: none,
    setAttributes: none,
    report: none,
  };
}

interface BodyProps {
  node: PaneNode;
  host: PaneHost;
  paused: boolean;
  focused: boolean;
  inPeek?: boolean;
  /** The header's slot for the content's own controls (useHeaderActions). */
  header?: HeaderSlot;
}

/** The pane's content. Memoised on what the kind actually sees, so divider drags don't re-render content. */
export const PaneBody = /* @__PURE__ */ memo(
  function PaneBody({ node, host, paused, focused, inPeek = false, header }: BodyProps) {
    const store = useStore();
    const { kinds } = useEnv();
    const { messages } = useStore();
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
      () => ({
        id: inPeek ? null : node.id,
        host,
        props,
        ...(header && !inPeek ? { header } : {}),
      }),
      [inPeek, node.id, host, props, header],
    );
    if (!def) {
      return (
        <div className="jali-pane-missing" role="alert">
          <strong>{messages.pane.unknownKind(node.ref.kind)}</strong>
          <UnknownKindHelp />
        </div>
      );
    }
    // A ref its kind can't read (a required param missing, a value of the wrong type) never reaches the component:
    // the kind's Missing shows instead, or Jali's own message.
    const problems = kinds.problems(node.ref);
    const close = () => (inPeek ? store.actions.peek(null) : store.actions.close(node.id));
    const Missing = problems.length ? def.Missing : undefined;
    if (problems.length && !Missing) {
      return (
        <div className="jali-pane-missing" role="alert">
          <strong>{messages.pane.cantOpen(node.ref.kind)}</strong>
          <span>{messages.pane.cantOpenHelp(problems)}</span>
        </div>
      );
    }
    const Loading = def.Loading;
    return (
      <PaneContext.Provider value={context}>
        <PaneBoundary
          resetKey={JSON.stringify(node.ref)}
          host={host}
          name={kinds.title(node.ref)}
          close={close}
          onError={(error) =>
            store.env.onPaneError?.(error, { pane: inPeek ? null : node.id, ref: node.ref })
          }
          loading={Loading ? <Loading {...props} /> : <DefaultLoading />}
          hydration={paneHydration(store)}
        >
          {Missing ? (
            <Missing {...props} problems={problems} close={close} />
          ) : (
            <def.Component {...props} />
          )}
          {/* Inside the boundary: a header control that throws or waits does so with its pane. */}
          {header && !inPeek ? <HeaderControls slot={header} /> : null}
        </PaneBoundary>
      </PaneContext.Provider>
    );
  },
  (a, b) =>
    a.host === b.host &&
    a.header === b.header &&
    a.node.id === b.node.id &&
    a.paused === b.paused &&
    a.focused === b.focused &&
    a.node.linkedTo === b.node.linkedTo &&
    a.node.kept === b.node.kept &&
    sameRef(a.node.ref, b.node.ref),
);

/**
 * How to open what's missing, with the palette's key. A part of its own: the key's label changes once the page has
 * hydrated, and the body around a pane's Suspense boundary must not re-render for that (state/hydration.ts).
 */
function UnknownKindHelp() {
  const keymap = useKeymap();
  return <span>{useMessages().pane.unknownKindHelp(keymap.format(parseKeys("Mod+K")))}</span>;
}
