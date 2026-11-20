import { own } from "@jali/core/adapter";
import { memo, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { TabMenu, type TabMenuAt } from "./TabMenu";
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
import { ICON } from "../icons/sized";
import { createHeaderSlot, useHasHeaderControls, useNarrowHeader } from "./header";

interface Props {
  frame: Frame;
  chrome: Chrome;
  dropTarget: boolean;
}

/** The event happened in the element's own DOM, not in something a control in it portalled elsewhere. */
const inHeader = (e: SyntheticEvent) => e.currentTarget.contains(e.target as Node);

export const PaneFrame = /* @__PURE__ */ memo(
  function PaneFrame({ frame, chrome, dropTarget }: Props) {
    const { node, rect, hidden, focused, zoomed, covered, group } = frame;
    const alone = chrome === ALONE_CHROME;
    const store = useStore();
    const [menu, setMenu] = useState<TabMenuAt | null>(null);
    // Popped out (experimental): the content renders in a floating window; its place here says so.
    const popTarget = usePopOutTarget(store, node.id);
    const icon = useJaliIcons();
    const { actions } = store;
    const activity = useUi((s) => own(s.activity, node.id));
    const dirty = useUnsavedOf(node.id);
    const renaming = useUi((s) => s.renaming === node.id) && !group;
    const canRename = useCanRename();
    const coveredRef = useInert(covered);
    const isDragged = useUi((s) => s.dnd?.dragged === node.id);
    const host = useMemo(() => paneHost(store, node.id), [store, node.id]);
    // The content's own controls (useHeaderActions), and how far a narrow header has given way to keep its title.
    const header = useMemo(createHeaderSlot, []);
    const tools = useHasHeaderControls(header);
    const headerRef = useRef<HTMLDivElement>(null);
    const narrow = useNarrowHeader(headerRef, tools ? 2 : 1);
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
        data-covered={covered || undefined}
        aria-hidden={covered || undefined}
        ref={coveredRef}
        onPointerDownCapture={() => actions.focus(node.id)}
        onFocusCapture={() => store.get().view.focused !== node.id && actions.focus(node.id)}
        // The pane's menu from the keyboard (Shift+F10 or the menu key), on the pane or its header: a tab opens its
        // own, and the content's keys are the app's.
        onKeyDown={(e) => {
          if (bare || e.defaultPrevented) return;
          if (!(e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey))) return;
          const target = e.target as HTMLElement;
          const header = e.currentTarget.querySelector<HTMLElement>(".jali-pane-header");
          if (target !== e.currentTarget && !header?.contains(target)) return;
          if (target.closest("input, textarea, [contenteditable]")) return;
          e.preventDefault();
          const r = (
            e.currentTarget.querySelector<HTMLElement>(".jali-act-menu") ?? header
          )?.getBoundingClientRect();
          if (!r) return;
          const rtl = store.get().dir === "rtl";
          setMenu({ pane: node.id, x: rtl ? r.left : r.right, y: r.bottom + 2, end: true });
        }}
        className={cls}
        style={style}
      >
        <div
          ref={headerRef}
          className="jali-pane-header"
          data-narrow={narrow === 2 ? "tools" : narrow === 1 ? "actions" : undefined}
          // Right-click on the header (not a tab: its strip has its own) opens the pane's menu. The content below is
          // the app's, so its right-click stays the app's. Each handler takes only events from inside the header's
          // DOM: React also passes up events from what a header control portalled elsewhere (a menu, an app's
          // popover), and a press there must not drag the pane, nor a double-click maximise it.
          onContextMenu={(e) => {
            if (
              bare ||
              group ||
              !inHeader(e) ||
              (e.target as HTMLElement).closest("input, textarea, [contenteditable]")
            )
              return;
            e.preventDefault();
            setMenu({ pane: node.id, x: e.clientX, y: e.clientY });
          }}
          onPointerDown={
            draggable ? (e) => inHeader(e) && startPaneDrag(store, e, node.id) : undefined
          }
          onDoubleClick={(e) => {
            if (bare || !chrome.zoomable || !inHeader(e)) return;
            if ((e.target as HTMLElement).closest("button")) return;
            actions.toggleZoom(node.id);
          }}
        >
          {draggable ? (
            <span className="jali-grip" aria-hidden>
              <icon.grip {...ICON.header} />
            </span>
          ) : null}
          {group ? (
            <div className="jali-bare-inert" ref={bareRef}>
              <TabStrip group={group} owner={node.id} />
            </div>
          ) : (
            <div className="jali-pane-title">
              {role ? <role.icon {...ICON.title} aria-hidden /> : <KindIcon kind={node.ref.kind} />}
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
          {tools && !bare && narrow < 2 ? (
            <div className="jali-pane-tools" ref={header.target} />
          ) : null}
          {bare ? null : (
            <HeaderActions
              id={node.id}
              title={title}
              zoomed={zoomed}
              chrome={chrome}
              tabs={!!group}
              narrow={narrow}
              onMenu={(at) => setMenu({ pane: node.id, ...at })}
            />
          )}
        </div>
        {menu ? (
          <TabMenu
            at={menu}
            commands={narrow === 2}
            onClose={(refocus) => {
              setMenu(null);
              if (refocus) store.dom.pane(node.id)?.focus({ preventScroll: true });
            }}
          />
        ) : null}
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
                <PaneBody
                  node={node}
                  host={host}
                  header={header}
                  paused={false}
                  focused={focused}
                />
              </div>,
              popTarget,
            )
          ) : (
            <div className="jali-pane-content-inner">
              <PaneBody
                node={node}
                host={host}
                header={header}
                paused={hidden || covered || !!frame.outOfView}
                focused={focused}
              />
            </div>
          )}
        </div>
      </section>
    );
  },
  (a, b) => a.chrome === b.chrome && a.dropTarget === b.dropTarget && sameFrame(a.frame, b.frame),
);
