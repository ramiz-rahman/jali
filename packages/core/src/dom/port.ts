/**
 * The adapter's markup, as the core needs to find it. The core moves focus, drags dividers and panes, and scrolls rows
 * on the elements an adapter renders, but it never names their classes or structure: it asks the adapter's `DomPort`
 * (@jali/react's is `reactDom`), which the adapter gives the instance with `store.dom.use(port)`. Until one is given,
 * every lookup finds nothing and every mark does nothing, so an instance no adapter renders still runs.
 *
 * What stays in the core: the ids it gives panes (`paneDomId`), the root and layer the adapter attaches, generic web
 * semantics (`[role=dialog]`, `[role=separator]`, `[tabindex="0"]`) and the attributes the host itself writes
 * (`data-jali-chrome`, `data-pane-region`, `data-no-drag`, `data-drag-ok`, `data-autofocus`).
 */
import type { Axis, NodeId, Rect } from "../layout/types";

/** The line drawn along a divider while it is dragged, as the adapter renders it. */
export interface DividerLine {
  /** Show it for a divider of `axis`, at `rect`. */
  show(axis: Axis, rect: Rect): void;
  /** Move it to `rect`. */
  place(rect: Rect): void;
  /** Mark that the size has snapped to the centre, or no longer has. */
  snap(on: boolean): void;
  hide(): void;
}

/** What is being dragged, for the page's cursor and styles while it lasts. */
export type DragKind = "pane" | Axis;

export interface DomPort {
  /** The element the panes are placed in, in `root`: drop coordinates are measured from its box. `from` is the
   *  element the drag started on, when it is inside one. */
  panes(root: ParentNode, from: Element | null): HTMLElement | null;
  /** The pane tab at a point on screen (client coordinates), and its pane. */
  tabAt(x: number, y: number): { el: HTMLElement; pane: NodeId } | undefined;
  /** A pane's tab in `root`. */
  tab(root: ParentNode, pane: NodeId): HTMLElement | null;
  /** The pane whose tab `el` is, or is inside. */
  tabOf(el: Element): NodeId | undefined;
  /** `el` is inside a pane. */
  inPane(el: Element): boolean;
  /** `el` is a divider, or inside one. */
  inDivider(el: Element): boolean;
  /** The dividers in `root`, by key (`dividerKey`). */
  dividers(root: ParentNode): Iterable<readonly [key: string, el: HTMLElement]>;
  /** The rows that scroll in `root`, by id: the window, and the content that moves inside it. */
  strips(
    root: ParentNode,
  ): Iterable<readonly [id: string, frame: HTMLElement, content: HTMLElement | null]>;
  /** The scrolling element of the row that scrolls a pane is in. */
  stripScroller(pane: HTMLElement): HTMLElement | null;
  /** Hold a pane's content at the size it has now, while its frame moves with a divider (`holdWhileResizing`).
   *  Returns the release, or null when the pane has no content to hold. */
  hold(frame: HTMLElement): (() => void) | null;
  /** The line drawn while `divider` is dragged. */
  dividerLine(divider: HTMLElement): DividerLine | null;
  /** The shelf in `root`, if rendered. */
  shelf(root: ParentNode): HTMLElement | null;
  /** The chip in the shelf that takes focus: the roving one, else the first. */
  shelfChip(shelf: HTMLElement): HTMLElement | null;
  /** A drag starts (`what`, and the divider dragged) or ends (`null`). */
  dragging(what: DragKind | null, divider?: HTMLElement): void;
  /** A brief highlight on a tab or a pane, so the eye finds where a pane went or what a link landed on. */
  flash(el: HTMLElement): void;
}

/** The port before an adapter gives one: nothing found, nothing marked. */
export const noDom: DomPort = {
  panes: () => null,
  tabAt: () => undefined,
  tab: () => null,
  tabOf: () => undefined,
  inPane: () => false,
  inDivider: () => false,
  dividers: () => [],
  strips: () => [],
  stripScroller: () => null,
  hold: () => null,
  dividerLine: () => null,
  shelf: () => null,
  shelfChip: () => null,
  dragging: () => {},
  flash: () => {},
};
