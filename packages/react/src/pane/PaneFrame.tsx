import { memo, useMemo, type CSSProperties } from "react";
import { GripHorizontal } from "lucide-react";
import { paneDomId, paneTitleId } from "@jali/core";
import { roleOf, titleOf } from "@jali/core";
import { useStore, useUi } from "../state/react";
import { startPaneDrag } from "@jali/core";
import { DropZoneLabel } from "../workspace/DropIndicator";
import { sameFrame, type Frame } from "@jali/core";
import { Activity } from "./Activity";
import { FollowControl, NotInResults } from "./FollowControl";
import type { Chrome } from "@jali/core";
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
  const review = useUi((s) => !!s.review);
  // A curated page in Single: the page tabs name the one view and choose it, so the pane header is visually hidden
  // and offers nothing (no grip, tuck, maximise or close) that a keyboard user could land on unseen.
  const bare = useUi((s) => s.review?.mode === "single");
  const boundary = useUi((s) => s.settings.boundary);
  const env = store.env, profile = env.profile;
  const role = review && node.role && profile ? roleOf(profile, node.role) : undefined;
  // In a curated workspace, a pane without a role was opened by following a link: it belongs to the investigation.
  const opened = review && !node.role;
  const title = titleOf(env, node);
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.width, height: rect.height, display: hidden ? "none" : undefined };
  const cls = ["jali-pane", !chrome.island && "is-single", focused && "is-focused", zoomed && "is-zoomed", isDragged && "is-dragged", dropTarget && "is-drop-target"]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      id={paneDomId(store.dom.id, node.id)}
      role="region"
      aria-labelledby={paneTitleId(store.dom.id, node.id)}
      tabIndex={-1}
      data-pane={node.id}
      data-kind={node.ref.kind}
      data-focused={focused || undefined}
      data-zoomed={zoomed || undefined}
      data-origin={opened ? "opened" : role ? "role" : undefined}
      data-boundary={opened ? boundary : undefined}
      aria-hidden={covered || undefined}
      inert={covered || undefined}
      onPointerDownCapture={() => actions.focus(node.id)}
      onFocusCapture={() => store.get().view.focused !== node.id && actions.focus(node.id)}
      className={cls}
      style={style}
    >
      <header
        className="jali-pane-header"
        onPointerDown={chrome.draggable && !bare ? (e) => startPaneDrag(store, e, node.id) : undefined}
        onDoubleClick={(e) => {
          if (bare || !chrome.zoomable || (e.target as HTMLElement).closest("button")) return;
          actions.toggleZoom(node.id);
        }}
      >
        {chrome.draggable && !bare ? (
          <span className="jali-grip" aria-hidden>
            <GripHorizontal size={14} strokeWidth={1.5} />
          </span>
        ) : null}
        {group ? (
          <div className="jali-bare-inert" inert={bare || undefined}><TabStrip group={group} owner={node.id} /></div>
        ) : (
          <div className="jali-pane-title">
            {role ? <role.icon size={16} strokeWidth={1.5} aria-hidden /> : <KindIcon kind={node.ref.kind} />}
            <h2 id={paneTitleId(store.dom.id, node.id)}>{title}</h2>
            {role && env.kinds.title(node.ref) !== title ? <span className="jali-pane-sub">{env.kinds.title(node.ref)}</span> : null}
            <Activity a={activity} />
            {bare ? null : <FollowControl node={node} title={title} />}
            {opened && boundary === "tint" ? <span className="jali-badge jali-badge-opened">Opened</span> : null}
          </div>
        )}
        {bare ? null : <HeaderActions id={node.id} title={title} zoomed={zoomed} chrome={chrome} />}
      </header>
      {dropTarget ? <DropZoneLabel paneId={node.id} /> : null}
      <NotInResults node={node} />
      <div className="jali-pane-content">
        <div className="jali-pane-content-inner">
          <PaneBody node={node} host={host} paused={hidden || covered} focused={focused} />
        </div>
      </div>
    </section>
  );
}, (a, b) => a.chrome === b.chrome && a.dropTarget === b.dropTarget && sameFrame(a.frame, b.frame));
