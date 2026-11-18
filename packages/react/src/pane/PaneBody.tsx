import { memo, useMemo } from "react";
import type { NodeId, ObjectRef, PaneNode } from "@jali/core";
import type { Actions } from "@jali/core";
import { openPaneFor } from "@jali/core";
import type { PaneActivity, PaneCommand } from "@jali/core";
import type { PaneComponentProps, PaneKindDef } from "../define";
import { PaneIdContext } from "./usePaneState";
import { useModel, useUi, useEnv } from "../state/react";
import type { UiStore } from "@jali/core";
import { KindIcon } from "./icons";
import { keyHint } from "@jali/core";

/** What a pane's content can ask of the workspace. A pane in the layout acts for itself; the peek sheet acts for the
 *  pane it came from and has no place of its own to fill, close or report on. */
export interface PaneHost {
  openBeside(ref: ObjectRef): void;
  peek(ref: ObjectRef | null): void;
  select(ref: ObjectRef | null, opts?: { inResults?: boolean }): void;
  openHere(ref: ObjectRef): void;
  dismiss(): void;
  setActivity(a: PaneActivity): void;
  setUnsaved(what: string | null): void;
  setCommands(commands: PaneCommand[] | null): void;
}

export const paneHost = (actions: Actions, id: NodeId): PaneHost => ({
  openBeside: (ref) => actions.openBeside(id, ref),
  peek: (ref) => actions.peek(ref, id),
  select: (ref, opts) => actions.select(id, ref, opts),
  openHere: (ref) => actions.openHere(id, ref),
  dismiss: () => actions.dismiss(id),
  setActivity: (a) => actions.setActivity(id, a),
  setUnsaved: (what) => actions.setUnsaved(id, what),
  setCommands: (commands) => actions.setPaneCommands(id, commands),
});

export function peekHost(store: UiStore): PaneHost {
  const source = () => store.get().peekSource ?? store.get().view.focused ?? "";
  const none = () => {};
  return {
    openBeside: (ref) => store.actions.openBeside(source(), ref),
    peek: (ref) => store.actions.peek(ref, source()),
    select: (ref) => store.actions.select(source(), ref),
    openHere: none, dismiss: none, setActivity: none, setUnsaved: none, setCommands: none,
  };
}

interface BodyProps { node: PaneNode; host: PaneHost; paused: boolean; focused: boolean; inPeek?: boolean }

/** A transient kind (the launcher) chooses from the workspace: it gets Recent, what is open, icons and titles. */
function WithSources({ def, props }: { def: PaneKindDef; props: Omit<PaneComponentProps, "recent" | "isOpen" | "KindIcon" | "titleFor"> }) {
  const recent = useUi((s) => s.recent);
  const m = useModel();
  const isOpen = useMemo(() => (ref: ObjectRef) => !!openPaneFor(m, ref, props.node.id), [m, props.node.id]);
  const C = def.Component;
  return <C {...props} recent={recent} isOpen={isOpen} KindIcon={KindIcon} titleFor={m.env.kinds.title} />;
}

/** The pane's content. Memoised on what the kind actually sees, so divider drags don't re-render content. */
export const PaneBody = memo(
  function PaneBody({ node, host, paused, focused, inPeek = false }: BodyProps) {
    const def = useEnv().kinds.get(node.ref.kind);
    if (!def) {
      return (
        <div className="jali-pane-missing" role="alert">
          <strong>Unknown pane kind “{node.ref.kind}”.</strong>
          <span>This pane stays in place so the layout keeps its shape. Close it or reset the layout from the command palette ({keyHint("Mod+K")}).</span>
        </div>
      );
    }
    const props = { node, ref: node.ref, paused, focused, inPeek, ...host };
    const C = def.Component;
    // The peek sheet shows a node that is not in the layout: it has no state of its own to keep.
    return (
      <PaneIdContext.Provider value={inPeek ? null : node.id}>
        {def.transient ? <WithSources def={def} props={props} /> : <C {...props} />}
      </PaneIdContext.Provider>
    );
  },
  (a, b) =>
    a.host === b.host && a.node.id === b.node.id && a.paused === b.paused && a.focused === b.focused &&
    a.node.linkedTo === b.node.linkedTo && a.node.pinned === b.node.pinned && JSON.stringify(a.node.ref) === JSON.stringify(b.node.ref),
);
