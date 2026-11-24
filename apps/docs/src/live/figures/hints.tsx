/**
 * What a reader can try in a figure, worked out from the layout it starts with: the same on the server and in the
 * browser, so the row never differs between the prerendered page and the hydrated one. In order of what matters most:
 * the hero's bar keeps one line and leaves out the ones that don't fit.
 */
import type { ReactNode } from "react";
import {
  ArrowsHorizontalIcon,
  CursorClickIcon,
  HandGrabbingIcon,
  HandIcon,
  MouseRightClickIcon,
  TreeStructureIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { LayoutNode, PaneNode } from "jali";
import { buildDemoLayout, type DemoLayoutId } from "../shop/layouts";

export interface Hint {
  icon: ReactNode;
  text: string;
  /** Needs panes side by side, so it is left out where a phone shows one pane at a time. */
  sideBySide?: boolean;
}

/** What the figure shows of its tree: the map, the JSON (or both), or nothing until the reader opens it. */
export type TreeShown = "map" | "json" | "none";

const panesOf = (n: LayoutNode): PaneNode[] =>
  n.type === "pane" ? [n] : n.children.flatMap(panesOf);
const hasSplit = (n: LayoutNode): boolean =>
  n.type !== "pane" && ((n.type !== "stack" && n.children.length > 1) || n.children.some(hasSplit));

export function hintsFor(layout: DemoLayoutId, tree: TreeShown): Hint[] {
  const root = buildDemoLayout(layout).root;
  const panes = panesOf(root);
  // An order list with a detail following it: the shop's own hints.
  const list = panes.find((p) => p.ref.kind === "orders");
  const follows = !!list && panes.some((p) => p.linkedTo === list.id && p.follows);
  const hints: (Hint | false)[] = [
    follows && {
      icon: <CursorClickIcon size={15} aria-hidden />,
      text: "Click an order, and the detail follows",
    },
    panes.length > 1 && {
      icon: <HandGrabbingIcon size={15} aria-hidden />,
      text: "Drag a pane onto another",
      sideBySide: true,
    },
    follows && {
      icon: <MouseRightClickIcon size={15} aria-hidden />,
      text: "Right-click an order for more",
      sideBySide: true,
    },
    tree === "none"
      ? {
          icon: <TreeStructureIcon size={15} aria-hidden />,
          text: "Show the layout tree to see how it is built",
        }
      : {
          icon: <HandIcon size={15} aria-hidden />,
          text:
            tree === "json"
              ? "Point at a box or a JSON block to find its pane"
              : "Point at a box to find its pane",
        },
    hasSplit(root) && {
      icon: <ArrowsHorizontalIcon size={15} aria-hidden />,
      text: "Drag a divider",
      sideBySide: true,
    },
    panes.length > 1 && { icon: <XIcon size={15} aria-hidden />, text: "Close a pane" },
  ];
  return hints.filter((h): h is Hint => !!h);
}

/** The row of hints. */
export function Tries({ hints }: { hints: Hint[] }) {
  return (
    <ul className="live-tries" aria-label="Things to try">
      {hints.map((h) => (
        <li key={h.text} data-side-by-side={h.sideBySide || undefined}>
          {h.icon}
          <span>{h.text}</span>
        </li>
      ))}
    </ul>
  );
}
