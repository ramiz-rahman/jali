import { own } from "@jali/core/adapter";
import { memo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { PaneOutlet, usePaneParts } from "./content";
import { TabMenu, type TabMenuAt } from "./TabMenu";
import { useJaliIcons } from "../icons/context";
import {
  ALONE_CHROME,
  allows,
  paneDomId,
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
import { TabStrip } from "./TabStrip";
import { UnsavedMark, useUnsavedOf } from "./Unsaved";
import { renameFieldOf, useCanRename } from "./rename";
import { useInert } from "./inert";
import { ICON } from "../icons/sized";
import { useHasHeaderControls } from "./header-slot";
import { useNarrowHeader } from "./header-width";
import { useWorkspaceLabel } from "../a11y/landmark";
import { panelId, tabId, titleId } from "../ids";

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
    // What opened the menu (the ⋯ button, the pane for a right-click or Shift+F10): focus goes back there when it
    // closes. Taken from the event, not from what has focus: Safari doesn't focus a button it is clicked.
    const opener = useRef<HTMLElement | null>(null);
    const openMenu = (at: TabMenuAt, from: HTMLElement | null) => {
      opener.current = from;
      setMenu(at);
    };
    const RenameField = renameFieldOf(store);
    const icon = useJaliIcons();
    const { actions } = store;
    const activity = useUi((s) => own(s.activity, node.id));
    const dirty = useUnsavedOf(node.id);
    const renaming = useUi((s) => s.renaming === node.id) && !group;
    const canRename = useCanRename();
    const coveredRef = useInert(covered);
    const isDragged = useUi((s) => s.dnd?.dragged === node.id);
    // The pane's parts, wherever its content renders (content.tsx).
    const parts = usePaneParts(node.id);
    // The content's own controls (useHeaderActions), and how far a narrow header has given way to keep its title.
    const { header } = parts;
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
    const named = useWorkspaceLabel();
    const role = page && node.role && profile ? roleOf(profile, node.role) : undefined;
    // In a curated page, a pane without a role was opened by following a link: it belongs to the investigation.
    const opened = page && !node.role;
    // Its own live title only: another pane's new title doesn't re-render this frame.
    const live = useUi((s) => own(s.titles, node.id));
    const titles = live === undefined ? undefined : { [node.id]: live };
    const marks = usePaneAttributesOf(node.id);
    const title = titleOf(env, node, titles);
    const shows = shownTitle(env, node, titles);
    // Full screen: the pane covers the window (and the browser, asked by the instance, takes the whole screen).
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
      !chrome.island && "is-bare",
      alone && "is-alone",
      full && "is-bare",
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
        // Named by its title; in an instance the host named, by its title and the instance's name.
        {...(named.label
          ? { "aria-label": store.messages.panes.within(title, named.label) }
          : { "aria-labelledby": titleId(store.dom.id, node.id) })}
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
        onPointerDownCapture={() => actions.focusPane(node.id)}
        onFocusCapture={() => store.get().view.focused !== node.id && actions.focusPane(node.id)}
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
          openMenu(
            { pane: node.id, x: rtl ? r.left : r.right, y: r.bottom + 2, end: true },
            e.currentTarget,
          );
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
            openMenu({ pane: node.id, x: e.clientX, y: e.clientY }, store.dom.pane(node.id));
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
                id={titleId(store.dom.id, node.id)}
                onDoubleClick={(e) => {
                  // A title that can be renamed opens the field; anywhere else in the header maximises.
                  if (bare || !canRename(node.id)) return;
                  e.stopPropagation();
                  actions.startRename(node.id);
                }}
              >
                {renaming && RenameField ? <RenameField pane={node.id} title={title} /> : title}
              </h2>
              {role && shows !== title ? <span className="jali-pane-sub">{shows}</span> : null}
              {dirty ? <UnsavedMark labelled /> : null}
              <Activity activity={activity} />
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
              onMenu={(at, from) => openMenu({ pane: node.id, ...at }, from)}
            />
          )}
        </div>
        {menu ? (
          <TabMenu
            at={menu}
            commands={narrow === 2}
            onClose={(refocus) => {
              setMenu(null);
              const back = opener.current;
              opener.current = null;
              if (refocus)
                (back?.isConnected && back !== document.body
                  ? back
                  : store.dom.pane(node.id)
                )?.focus({ preventScroll: true });
            }}
          />
        ) : null}
        {dropTarget ? <DropZoneLabel paneId={node.id} /> : null}
        <NotInResults node={node} />
        {/* Its tab's panel, when it shows for a tab strip (APG tabs): the region stays on the section. */}
        <PaneOutlet
          frame={frame}
          parts={parts}
          panel={{
            id: panelId(store.dom.id, node.id),
            ...(group ? { role: "tabpanel", "aria-labelledby": tabId(store.dom.id, node.id) } : {}),
          }}
        />
      </section>
    );
  },
  (a, b) => a.chrome === b.chrome && a.dropTarget === b.dropTarget && sameFrame(a.frame, b.frame),
);
