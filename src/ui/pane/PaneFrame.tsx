import { memo, useMemo, type CSSProperties } from "react";
import { GripHorizontal } from "lucide-react";
import { paneDomId, paneTitleId } from "../dom/ids";
import { paneTitle } from "../pane-kinds";
import { useStore, useUi } from "../state/react";
import { startPaneDrag } from "../workspace/dnd";
import { DropZoneLabel } from "../workspace/DropIndicator";
import { sameFrame, type Frame } from "../workspace/frames";
import { Activity } from "./Activity";
import type { Chrome } from "./chrome";
import { HeaderActions } from "./HeaderActions";
import { KindIcon } from "./icons";
import { PaneBody, paneHost } from "./PaneBody";
import { TabStrip } from "./TabStrip";

interface Props { frame: Frame; chrome: Chrome; dropTarget: boolean }

export const PaneFrame = memo(function PaneFrame({ frame, chrome, dropTarget }: Props) {
  const { node, rect, hidden, focused, zoomed, covered, group } = frame;
  const store = useStore();
  const { actions } = store;
  const activity = useUi((s) => s.activity[node.id]);
  const isDragged = useUi((s) => s.dnd?.dragged === node.id);
  const host = useMemo(() => paneHost(actions, node.id), [actions, node.id]);
  const title = paneTitle(node.ref);
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.width, height: rect.height, display: hidden ? "none" : undefined };
  const cls = ["pane", !chrome.island && "is-single", focused && "is-focused", zoomed && "is-zoomed", isDragged && "is-dragged", dropTarget && "is-drop-target"]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      id={paneDomId(node.id)}
      role="region"
      aria-labelledby={paneTitleId(node.id)}
      tabIndex={-1}
      data-pane={node.id}
      data-kind={node.ref.kind}
      data-focused={focused || undefined}
      data-zoomed={zoomed || undefined}
      aria-hidden={covered || undefined}
      inert={covered || undefined}
      onPointerDownCapture={() => actions.focus(node.id)}
      onFocusCapture={() => store.get().view.focused !== node.id && actions.focus(node.id)}
      className={cls}
      style={style}
    >
      <header
        className="pane-header"
        onPointerDown={chrome.draggable ? (e) => startPaneDrag(store, e, node.id) : undefined}
        onDoubleClick={(e) => {
          if (!chrome.zoomable || (e.target as HTMLElement).closest("button")) return;
          actions.toggleZoom(node.id);
        }}
      >
        {chrome.draggable ? (
          <span className="grip" aria-hidden>
            <GripHorizontal size={14} strokeWidth={1.5} />
          </span>
        ) : null}
        {group ? (
          <TabStrip group={group} owner={node.id} />
        ) : (
          <div className="pane-title">
            <KindIcon kind={node.ref.kind} />
            <h2 id={paneTitleId(node.id)}>{title}</h2>
            <Activity a={activity} />
            {node.pinned ? <span className="badge">Pinned</span> : null}
          </div>
        )}
        <HeaderActions id={node.id} title={title} zoomed={zoomed} chrome={chrome} />
      </header>
      {dropTarget ? <DropZoneLabel paneId={node.id} /> : null}
      <div className="pane-content">
        <div className="pane-content-inner">
          <PaneBody node={node} host={host} paused={hidden || covered} focused={focused} />
        </div>
      </div>
    </section>
  );
}, (a, b) => a.chrome === b.chrome && a.dropTarget === b.dropTarget && sameFrame(a.frame, b.frame));
