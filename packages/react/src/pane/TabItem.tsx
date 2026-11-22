import { own } from "@jali/core/adapter";
import { panelId, tabId, titleId } from "../ids";
import type { Direction, NodeId, PaneNode } from "@jali/core";
import { useLayoutEffect, useRef } from "react";
import { useJaliIcons } from "../icons/context";
import type { Tab, TabDrop } from "@jali/core/adapter";
import { allows } from "@jali/core/adapter";
import { roleOf, titleOf, startPaneDrag } from "@jali/core/adapter";
import { useEnv, usePaneAttributesOf, useStore, useUi } from "../state/react";
import { Activity, activityLabel } from "./Activity";
import { KindIcon } from "./icons";
import { renameFieldOf } from "./rename";
import type { TabMenuAt } from "./TabMenu";
import { UnsavedMark } from "./Unsaved";
import { ICON } from "../icons/sized";

/** What a tab needs from its strip: where it is, and what the strip decides for all its tabs. */
export interface TabItemProps {
  tab: Tab;
  /** The group the tab is in, which a click or Enter shows it in. */
  group: NodeId;
  /** The tab shown in its group. */
  active: boolean;
  /** The frame showing the group: the shown tab's title labels its region. */
  owner: NodeId;
  /** Its rename field has taken its place. */
  renaming: boolean;
  /** A tab dragged over the strip would go before or after this one. */
  drop: TabDrop["side"] | undefined;
  canRename: (id: NodeId) => boolean;
  dir: Direction;
  /** Scrolls the strip to show the tab (the shown one on mount, any one on focus). */
  reveal: (el: HTMLDivElement | null) => void;
  /** Opens the tab's menu at a point. */
  onMenu: (at: TabMenuAt) => void;
  /** Its size may have changed (its title, marks or unsaved mark did): the strip measures again. */
  onLaidOut: () => void;
}

/**
 * One tab of a strip, with what its own pane reports (live title, data-* attributes, unsaved mark, what it is doing):
 * it renders again when one of those changes, and the strip doesn't.
 *
 * A tab holds no controls (APG tabs, deletable tabs): its close and put back are its siblings in a presentational
 * wrapper. They are for the pointer: out of the tab order, and hidden from assistive technology, since a tablist may
 * own only tabs. The tab says what they do instead: Delete or Backspace closes it, and on a tucked tab the put back
 * command (which acts on a focused tucked tab) puts it back. Spacers inside the tab keep the buttons' room, so the
 * tab's box is as it was and the buttons sit on it.
 */
export function TabItem({
  tab: { node: t, tucked, folded: isFolded },
  group,
  active,
  owner,
  renaming,
  drop,
  canRename,
  dir,
  reveal,
  onMenu,
  onLaidOut,
}: TabItemProps) {
  const icon = useJaliIcons();
  const store = useStore();
  const { actions } = store;
  const words = store.messages;
  const tw = words.tabs;
  const live = useUi((s) => own(s.titles, t.id));
  const marks = usePaneAttributesOf(t.id);
  const dirty = useUi((s) => !!own(s.unsaved, t.id));
  const activity = useUi((s) => own(s.activity, t.id));
  const title = titleOf(store.env, t, live === undefined ? undefined : { [t.id]: live });
  // Measured again when what changes the tab's size changes, not on every render; on mount the strip measures.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) onLaidOut();
    mounted.current = true;
  }, [title, marks, dirty]);
  const pinned = !!t.pinned;
  // A tab behind says what its pane is doing ("Working"), as its dot shows; the shown tab's pane says it itself.
  const busy = active ? undefined : activityLabel(words.pane, activity);
  // Renaming: the field takes the tab's place until it closes.
  const RenameField = renameFieldOf(store);
  if (renaming && RenameField)
    return (
      <div className="jali-tab-item is-renaming" role="presentation" data-renaming>
        <RenameField pane={t.id} title={title} />
      </div>
    );
  const putBackKeys = store.keymap.label("pane.putBack");
  const description = tw.description(
    isFolded ? "folded" : tucked ? "tucked" : undefined,
    tucked ? putBackKeys : "",
  );
  return (
    <div
      className="jali-tab-item"
      role="presentation"
      data-drag-ok
      data-unsaved={dirty || undefined}
      data-drop={drop}
      data-pinned={pinned || undefined}
      onPointerDown={(e) => {
        e.stopPropagation();
        startPaneDrag(store, e, t.id);
      }}
      // The middle button closes a tab, as in a browser: the same close as its ×. Its press would start autoscroll.
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        actions.close(t.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu({ pane: t.id, x: e.clientX, y: e.clientY });
      }}
    >
      <div
        {...marks}
        ref={active ? reveal : undefined}
        className={`jali-tab${active ? " is-active" : ""}${tucked ? " is-tucked" : ""}${isFolded ? " is-folded" : ""}`}
        data-tab={t.id}
        data-tucked={tucked || undefined}
        data-folded={isFolded || undefined}
        data-unsaved={dirty || undefined}
        aria-label={title}
        data-pinned={pinned || undefined}
        aria-description={[busy, pinned && tw.pinned, dirty && words.pane.unsaved, description]
          .filter(Boolean)
          .join(". ")}
        aria-keyshortcuts="Delete Backspace Shift+F10"
        aria-haspopup="menu"
        title={isFolded ? tw.foldedTitle(title) : title}
        role="tab"
        id={tabId(store.dom.id, t.id)}
        aria-selected={active}
        aria-controls={panelId(store.dom.id, t.id)}
        tabIndex={active ? 0 : -1}
        onClick={() => actions.setActiveTab(group, t.id)}
        onDoubleClick={() => canRename(t.id) && actions.startRename(t.id)}
        // Focus scrolls the strip by the browser's rule (a tab wider than the strip shows its end); put it right.
        onFocus={(e) => reveal(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            actions.setActiveTab(group, t.id);
          } else if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
            // The tab's menu from the keyboard: under the tab, at its start.
            e.preventDefault();
            const r = e.currentTarget.getBoundingClientRect();
            onMenu({ pane: t.id, x: dir === "rtl" ? r.right : r.left, y: r.bottom + 2 });
          } else if (
            (e.key === "Delete" || e.key === "Backspace") &&
            !(e.metaKey || e.ctrlKey || e.altKey || e.shiftKey)
          ) {
            e.preventDefault();
            actions.close(t.id);
          }
        }}
      >
        {pinned ? (
          <span className="jali-tab-pin" aria-hidden>
            <icon.pin {...ICON.tabSmall} />
          </span>
        ) : null}
        <TabIcon node={t} />
        <span className="jali-tab-title" id={active ? titleId(store.dom.id, owner) : undefined}>
          {title}
        </span>
        <Activity activity={activity} />
        {isFolded ? (
          <span className="jali-tab-fold-mark" aria-hidden>
            <icon.fold {...ICON.tabMark} />
          </span>
        ) : null}
        {tucked ? <span className="jali-tab-space" aria-hidden /> : null}
        <span className="jali-tab-space" aria-hidden />
      </div>
      <span className="jali-tab-actions" aria-hidden>
        {tucked ? (
          <button
            type="button"
            className="jali-tab-putback"
            tabIndex={-1}
            aria-label={tw.putBack(title)}
            title={words.keys.withKeys(tw.putBackTip, putBackKeys)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => actions.putBack(t.id)}
          >
            <icon.putBack {...ICON.tab} aria-hidden />
          </button>
        ) : null}
        {/* A tab the app keeps open (`allow: { close: false }`) has no ×. */}
        {allows(store.snapshot(), t.id, "close") ? (
          <button
            type="button"
            className="jali-tab-close"
            tabIndex={-1}
            aria-label={tw.close(title)}
            onClick={() => actions.close(t.id)}
          >
            <icon.close {...ICON.tab} aria-hidden />
            {dirty ? <UnsavedMark /> : null}
          </button>
        ) : dirty ? (
          <UnsavedMark />
        ) : null}
      </span>
    </div>
  );
}

/** A role tab shows its role's icon; anything else its kind's. */
function TabIcon({ node }: { node: PaneNode }) {
  const { profile } = useEnv();
  const role =
    useUi((s) => !!s.page) && node.role && profile ? roleOf(profile, node.role) : undefined;
  return role ? (
    <role.icon {...ICON.tab} aria-hidden />
  ) : (
    <KindIcon kind={node.ref.kind} {...ICON.tab} />
  );
}
