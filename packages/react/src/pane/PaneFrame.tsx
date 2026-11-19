import { memo, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { bringBack, usePopOutTarget } from "./PopOut";
import { useJaliIcons } from "../icons/context";
import {
  ALONE_CHROME,
  allows,
  paneDomId,
  paneTitleId,
  roleOf,
  shownTitle,
  titleOf,
  startPaneDrag,
  sameFrame,
  type Frame,
} from "@jali/core/adapter";
import { usePaneAttributesOf, useStore, useUi } from "../state/react";
import { DropZoneLabel } from "../workspace/DropIndicator";
import { Activity } from "./Activity";
import { FollowControl, NotInResults } from "./FollowControl";
import type { Chrome } from "@jali/core/adapter";
import { HeaderActions } from "./HeaderActions";
import { KindIcon } from "./icons";
import { PaneBody, paneHost } from "./PaneBody";
import { TabStrip } from "./TabStrip";
import { UnsavedMark, useUnsavedOf } from "./Unsaved";
import { RenameField, useCanRename } from "./RenameField";
import { useInert } from "./inert";

interface Props {
  frame: Frame;
  chrome: Chrome;
  dropTarget: boolean;
}

export const PaneFrame = /* @__PURE__ */ memo(
  function PaneFrame({ frame, chrome, dropTarget }: Props) {
    const { node, rect, hidden, focused, zoomed, covered, group } = frame;
    const alone = chrome === ALONE_CHROME;
    const store = useStore();
    // Popped out (experimental): the content renders in a floating window; its place here says so.
    const popTarget = usePopOutTarget(store, node.id);
    const icon = useJaliIcons();
    const { actions } = store;
    const activity = useUi((s) => s.activity[node.id]);
    const dirty = useUnsavedOf(node.id);
    const renaming = useUi((s) => s.renaming === node.id) && !group;
    const canRename = useCanRename();
    const coveredRef = useInert(covered);
    const isDragged = useUi((s) => s.dnd?.dragged === node.id);
    const host = useMemo(() => paneHost(store, node.id), [store, node.id]);
    const page = useUi((s) => !!s.page);
    // A curated page in Single: the page tabs name the one view and choose it, so the pane header is visually hidden
    // and offers nothing (no grip, tuck, maximise or close) that a keyboard user could land on unseen.
    const bare = useUi((s) => s.page?.mode === "single");
    const bareRef = useInert(bare);
    // A grip only where the pane may be dragged (Jali's chrome, and the app's `allow`).
    const draggable = chrome.draggable && !bare && allows(store.snapshot(), node.id, "move");
    const boundary = useUi((s) => s.settings.boundary);
    const env = store.env,
      profile = env.profile;
    const role = page && node.role && profile ? roleOf(profile, node.role) : undefined;
    // In a curated workspace, a pane without a role was opened by following a link: it belongs to the investigation.
    const opened = page && !node.role;
    const titles = useUi((s) => s.titles);
    const marks = usePaneAttributesOf(node.id);
    const title = titleOf(env, node, titles);
    const shows = shownTitle(env, node, titles);
    // Full screen: the pane covers the window (and the browser, asked by the workspace, takes the whole screen).
    const full = useUi((s) => s.fullScreen === node.id) && !hidden;
    const style: CSSProperties = full
      ? { position: "fixed", inset: 0, zIndex: 50 }
      : {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          display: hidden ? "none" : undefined,
        };
    const cls = [
      "jali-pane",
      !chrome.island && "is-single",
      alone && "is-alone",
      full && "is-single",
      focused && "is-focused",
      zoomed && "is-zoomed",
      isDragged && "is-dragged",
      dropTarget && "is-drop-target",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <section
        {...marks}
        id={paneDomId(store.dom.id, node.id)}
        role="region"
        aria-labelledby={paneTitleId(store.dom.id, node.id)}
        tabIndex={-1}
        data-pane={node.id}
        data-kind={node.ref.kind}
        data-focused={focused || undefined}
        data-alone={alone || undefined}
        data-full-screen={full || undefined}
        data-zoomed={zoomed || undefined}
        data-dragged={isDragged || undefined}
        data-drop-target={dropTarget || undefined}
        data-unsaved={dirty || undefined}
        data-origin={opened ? "opened" : role ? "role" : undefined}
        data-boundary={opened ? boundary : undefined}
        aria-hidden={covered || undefined}
        ref={coveredRef}
        onPointerDownCapture={() => actions.focus(node.id)}
        onFocusCapture={() => store.get().view.focused !== node.id && actions.focus(node.id)}
        className={cls}
        style={style}
      >
        <div
          className="jali-pane-header"
          onPointerDown={draggable ? (e) => startPaneDrag(store, e, node.id) : undefined}
          onDoubleClick={(e) => {
            if (bare || !chrome.zoomable || (e.target as HTMLElement).closest("button")) return;
            actions.toggleZoom(node.id);
          }}
        >
          {draggable ? (
            <span className="jali-grip" aria-hidden>
              <icon.grip size={14} />
            </span>
          ) : null}
          {group ? (
            <div className="jali-bare-inert" ref={bareRef}>
              <TabStrip group={group} owner={node.id} />
            </div>
          ) : (
            <div className="jali-pane-title">
              {role ? <role.icon size={16} aria-hidden /> : <KindIcon kind={node.ref.kind} />}
              <h2
                id={paneTitleId(store.dom.id, node.id)}
                onDoubleClick={(e) => {
                  // A title that can be renamed opens the field; anywhere else in the header maximises.
                  if (bare || !canRename(node.id)) return;
                  e.stopPropagation();
                  actions.startRename(node.id);
                }}
              >
                {renaming ? <RenameField pane={node.id} title={title} /> : title}
              </h2>
              {role && shows !== title ? <span className="jali-pane-sub">{shows}</span> : null}
              {dirty ? <UnsavedMark labelled /> : null}
              <Activity a={activity} />
              {bare ? null : <FollowControl node={node} title={title} />}
              {opened && boundary === "tint" ? (
                <span className="jali-badge jali-badge-opened">{store.messages.pane.opened}</span>
              ) : null}
            </div>
          )}
          {bare ? null : (
            <HeaderActions
              id={node.id}
              title={title}
              zoomed={zoomed}
              chrome={chrome}
              tabs={!!group}
            />
          )}
        </div>
        {dropTarget ? <DropZoneLabel paneId={node.id} /> : null}
        <NotInResults node={node} />
        <div className="jali-pane-content">
          {popTarget ? (
            <div className="jali-popped-out" role="status">
              <span>{store.messages.pane.poppedOut}</span>
              <button type="button" className="jali-text-btn" onClick={bringBack}>
                {store.messages.pane.bringBack}
              </button>
            </div>
          ) : null}
          {popTarget ? (
            createPortal(
              <div className="jali-pane-content-inner">
                <PaneBody node={node} host={host} paused={false} focused={focused} />
              </div>,
              popTarget,
            )
          ) : (
            <div className="jali-pane-content-inner">
              <PaneBody node={node} host={host} paused={hidden || covered} focused={focused} />
            </div>
          )}
        </div>
      </section>
    );
  },
  (a, b) => a.chrome === b.chrome && a.dropTarget === b.dropTarget && sameFrame(a.frame, b.frame),
);
