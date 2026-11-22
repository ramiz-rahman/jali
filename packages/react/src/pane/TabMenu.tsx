import { own as ownOf } from "@jali/core/adapter";
import type { NodeId } from "@jali/core";
import { useMemo } from "react";
import { Menu, type MenuAt } from "../a11y/Menu";
import { paneMenu } from "./actions";
import type { TabMenuItem } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import { useModelValue, useStore } from "../state/react";
import { ICON } from "../icons/sized";

/** Where a tab's menu opens: at the pointer, or under the tab from the keyboard. */
export interface TabMenuAt extends MenuAt {
  pane: NodeId;
}

/**
 * A tab's own menu (APG menu): Jali's items for that tab, then the app's, in groups. Arrows move, Enter or Space
 * chooses, Esc closes and returns focus to the tab; a disabled item can be reached and says why, but does nothing.
 */
export function TabMenu({
  at,
  onClose,
  commands = false,
}: {
  at: TabMenuAt;
  onClose: (refocus: boolean) => void;
  /** Also list the pane's commands (useCommands), last: its header is too narrow for the app's controls. */
  commands?: boolean;
}) {
  const store = useStore();
  const icon = useJaliIcons();
  // Built once as the menu opens: what the tab could do then.
  const groups = useMemo(() => {
    const g = paneMenu(store, at.pane);
    // In place of the app's controls a narrow header hid: the pane's commands, in their own group.
    const own = commands ? (ownOf(store.get().paneCommands, at.pane) ?? []) : [];
    if (own.length)
      g.push(
        own.map((c) => ({
          id: `command:${c.id}`,
          title: c.title,
          run: c.run,
          ...(c.keys ? { keys: c.keys } : {}),
          ...(c.disabled ? { disabled: c.disabled } : {}),
        })),
      );
    return g;
  }, [store, at.pane, commands]);
  const node = store.model().pane(at.pane);
  // Its own tab's name only: another pane's title never re-renders an open menu.
  const title = useModelValue((m) => m.title(at.pane));

  const choose = (item: TabMenuItem) => {
    if (item.disabled) return;
    onClose(true);
    item.run();
  };
  if (!node) return null;
  return (
    <Menu
      at={at}
      onClose={onClose}
      className="jali-tab-menu jali-tab-actions-menu"
      aria-label={store.messages.tabs.tabMenuLabel(title)}
    >
      {groups.map((group, g) => (
        <div key={g} role="group">
          {g ? <div role="separator" className="jali-menu-sep" /> : null}
          {group.map((item) => {
            const why = typeof item.disabled === "string" ? item.disabled : undefined;
            return (
              <button
                key={item.id}
                type="button"
                data-menu-item={item.id}
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                aria-disabled={item.disabled ? true : undefined}
                aria-description={why}
                title={why}
                tabIndex={-1}
                className="jali-tab-menu-item"
                onClick={() => choose(item)}
              >
                <span className="jali-tab-menu-check" aria-hidden>
                  {item.checked ? <icon.current {...ICON.menuMark} /> : null}
                </span>
                <span className="jali-tab-menu-title">{item.title}</span>
                {item.keys ? <kbd className="jali-menu-keys">{item.keys}</kbd> : null}
              </button>
            );
          })}
        </div>
      ))}
    </Menu>
  );
}
