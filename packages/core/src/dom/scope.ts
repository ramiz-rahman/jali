/**
 * Where an instance lives in the DOM (its scope): the id prefix of its elements, the element the adapter attached, the
 * layer its dialogs render in, and the adapter's port (dom/port.ts) that finds the adapter's own elements in it. Every
 * DOM lookup the core makes (focus, drag, F6 regions) searches inside this scope only.
 */
import type { NodeId } from "../layout/types";
import { cssString, paneDomId } from "./ids";
import { noDom, type DomPort, type DragKind } from "./port";

/**
 * An instance's place in the DOM: the id prefix of its elements, the element that holds it (its app shell), set
 * by the component that renders it, and the adapter's `DomPort`, which finds the adapter's own elements in it. DOM
 * lookups (focus, drag, F6 regions) search inside `root()` only.
 */
export interface JaliDom {
  /** The prefix of its elements' ids. The adapter may scope it per mounted root (two instances with no `id`). */
  id: string;
  /** The adapter's markup, as the core needs to find it (dom/port.ts). `noDom` until the adapter gives one. */
  readonly port: DomPort;
  /** Give the instance the adapter's port. The adapter calls it before it renders the instance. */
  use(port: DomPort): void;
  /** What is being dragged by pointer now: a pane (or a page tab), a divider of a row or a column; null when nothing. */
  dragging(): DragKind | null;
  /** A drag starts or ends: kept here, and told to the port for the page's styles. */
  setDragging(what: DragKind | null, divider?: HTMLElement): void;
  /** The instance's root element; the document until one is attached. */
  root(): ParentNode;
  attach(el: Element | null): void;
  /** The element that holds this instance's dialogs (palette, settings, confirmations), which render outside the
   *  root; null until one is attached. Keys pressed there count as the instance's. */
  layer(): Element | null;
  attachLayer(el: Element | null): void;
  /** The element with this instance's pane id `id`, if rendered. */
  pane(id: NodeId): HTMLElement | null;
}

export function createDom(id: string): JaliDom {
  let el: Element | null = null,
    layer: Element | null = null,
    port: DomPort = noDom,
    drag: DragKind | null = null;
  const root = (): ParentNode => el ?? document;
  const dom: JaliDom = {
    id,
    get port() {
      return port;
    },
    use: (next) => {
      port = next;
    },
    dragging: () => drag,
    setDragging: (what, divider) => {
      drag = what;
      port.dragging(what, divider);
    },
    root,
    attach: (next) => {
      el = next;
    },
    layer: () => layer,
    attachLayer: (next) => {
      layer = next;
    },
    pane: (pane) =>
      typeof document === "undefined"
        ? null
        : root().querySelector<HTMLElement>(`[id=${cssString(paneDomId(dom.id, pane))}]`),
  };
  return dom;
}
