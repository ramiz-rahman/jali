import type { PaneNode } from "@jali/core";
import { useRef } from "react";
import { useRovingKeys } from "../a11y/roving";
import { useStore } from "../state/react";
import { landmarkName } from "../a11y/landmark";
import { SwitcherItem } from "./SwitcherItem";

/** Single view's pane switcher: every pane and tab, the current one selected. */
export function PaneSwitcher({
  panes,
  current,
  inView,
}: {
  panes: PaneNode[];
  current: string | undefined;
  /** Stacked view: both panes on screen, the current one among them. */
  inView?: string[];
}) {
  const store = useStore();
  const t = store.messages.workspace;
  const list = useRef<HTMLDivElement>(null);
  // ← → Home End move focus along the panes, wrapping both ways; Enter, Space or a click switches (manual activation:
  // switching moves focus into the pane, which would end the walk after one step).
  const keys = useRovingKeys(() => [
    ...(list.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []),
  ]);
  return (
    <nav className="jali-switcher" aria-label={landmarkName(store, t.switcher)}>
      <div
        className="jali-switch-list"
        role="tablist"
        aria-label={t.switcherList(panes.length)}
        ref={list}
        onKeyDown={keys}
      >
        {panes.map((p) => (
          <SwitcherItem
            key={p.id}
            node={p}
            selected={p.id === current}
            inView={inView?.includes(p.id)}
          />
        ))}
      </div>
    </nav>
  );
}
