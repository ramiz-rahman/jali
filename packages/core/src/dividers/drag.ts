/**
 * Divider pointer drag: presentation separate from the model (Rex).
 *
 * Pointer down captures the pointer and snapshots the committed layout. Each animation frame (at most one per frame)
 * turns the pointer into the first neighbour's size (clamped at both minimums, centre snap in at 10px, out at 16px),
 * asks the layout for the layout that size gives, resolves it, and writes the result straight onto the DOM:
 * the affected pane frames' left/top/width/height, and the accent drag line. No React state changes during the drag.
 * Pointer up commits that same layout object once, so the committed rects equal the last preview exactly; the URL is
 * written 120ms later (history "debounce"). Heavy panes hold their content at its pre-drag size and reflow on release.
 */
import * as core from "../layout/engine";
import type { Layout, NodeId, PaneBox, Rect } from "../layout/types";
import type { JaliDom, JaliStore } from "../state/store";
import { clampSize, dividerKey, geometryFor, snap } from "./resize";

/** True while a divider is dragged by pointer in this instance (keyboard resizes wait). */
export const isDividerDragging = (dom: Pick<JaliDom, "dragging">) => {
  const d = dom.dragging();
  return d === "row" || d === "column";
};

const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
function place(el: HTMLElement, r: Rect) {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
}

/** The adapter draws the drag line (`DomPort.dividerLine`); the divider is `e.currentTarget`. */
export function startDividerDrag(
  store: JaliStore,
  e: {
    pointerId: number;
    button: number;
    clientX: number;
    clientY: number;
    currentTarget: EventTarget | null;
  },
  parentId: NodeId,
  index: number,
) {
  if (e.button !== 0 || store.dom.dragging()) return;
  const sepEl = e.currentTarget as HTMLElement | null;
  const s0 = store.get();
  if (!sepEl || s0.view.zoomed) return;
  // The layout as drawn: a row that scrolls draws its panes at their place along its content, unscrolled.
  const m0 = store.model(),
    r0 = m0.content,
    ctx0 = store.ctx();
  const d0 = r0.dividers.find((d) => d.parentId === parentId && d.index === index);
  const g0 = d0 && geometryFor(m0, d0, r0);
  if (!d0 || !g0) return;

  const layout0 = s0.layout,
    view0 = s0.view;
  const row = g0.axis === "row";
  // The pointer moves on screen; the size is the first neighbour's, which right to left is the one on the right.
  const sign = row && ctx0.dir === "rtl" ? -1 : 1;
  const start = row ? e.clientX : e.clientY;
  const min = g0.a.min,
    max = g0.divider.max,
    centre = g0.total / 2;
  const centreOk = centre >= min && centre <= max;

  try {
    sepEl.setPointerCapture(e.pointerId);
  } catch {
    /* synthetic events have no active pointer */
  }

  // DOM handles, looked up once.
  const before = new Map<string, PaneBox>(r0.panes.map((b) => [b.id, b]));
  const frames = new Map<string, HTMLElement>();
  for (const b of r0.panes) {
    const el = store.dom.pane(b.id);
    if (el) frames.set(b.id, el);
  }
  const { port } = store.dom;
  const dividerEls = new Map(port.dividers(store.dom.root()));
  // Rows that scroll: their windows (and the content inside) move with a divider beside them.
  const strips = new Map(
    [...port.strips(store.dom.root())].map(([id, frame, content]) => [id, { frame, content }]),
  );
  const neighbours = new Set([
    ...(d0.neighbours?.[0] ?? g0.a.ids),
    ...(d0.neighbours?.[1] ?? g0.b.ids),
  ]);

  // Heavy panes hold their content at its current size; the frame around it still moves with the pointer.
  const held: (() => void)[] = [];
  for (const id of neighbours) {
    const box = before.get(id),
      frame = frames.get(id);
    const node = m0.pane(id);
    if (
      !box ||
      box.hidden ||
      !frame ||
      !node ||
      !store.env.kinds.get(node.ref.kind)?.holdWhileResizing
    )
      continue;
    const release = port.hold(frame);
    if (release) held.push(release);
  }

  store.dom.setDragging(g0.axis, sepEl);
  const line = port.dividerLine(sepEl);
  line?.show(g0.axis, d0.rect);

  let pointer = start;
  let snapped = false;
  let shownSize = g0.a.size;
  let preview: Layout = layout0;
  // The committed layout, resolved once for the whole drag: each frame then resolves only its preview.
  const plain0 = core.resolve(layout0, core.tree.noFocus(), ctx0);
  let raf = 0;
  const written = new Set<string>();

  const render = () => {
    raf = 0;
    let size = clampSize(g0.a.size + sign * (pointer - start), min, max);
    if (centreOk) {
      const s = snap(size, centre, snapped);
      snapped = s.snapped;
      if (snapped) size = s.size;
    } else snapped = false;
    line?.snap(snapped);
    if (Math.abs(size - shownSize) < 0.01) return;
    shownSize = size;

    const delta = size - g0.a.size;
    preview =
      Math.abs(delta) < 0.01
        ? layout0
        : core.resizeDivider(layout0, parentId, index, delta, ctx0, plain0);
    const r = preview === layout0 ? r0 : core.resolve(preview, view0, ctx0);

    // Pane frames: only the ones whose box differs from the committed one (plus any written earlier, to restore them).
    for (const b of r.panes) {
      const was = before.get(b.id),
        el = frames.get(b.id);
      if (!was || !el) continue;
      if (sameRect(was.rect, b.rect) && !!was.hidden === !!b.hidden && !written.has(b.id)) continue;
      place(el, b.rect);
      el.style.display = b.hidden ? "none" : "";
      written.add(b.id);
    }
    // Dividers inside the neighbours (and the line we drag) follow the same resolve.
    const was = new Map(r0.dividers.map((d) => [dividerKey(d), d.rect]));
    for (const d of r.dividers) {
      const k = dividerKey(d);
      const el = dividerEls.get(k),
        w = was.get(k);
      if (k === dividerKey(d0)) {
        line?.place(d.rect);
        continue;
      }
      if (el && w && (!sameRect(w, d.rect) || written.has(k))) {
        place(el, d.rect);
        written.add(k);
      }
    }
    for (const s of r.scrollers) {
      const { frame: el, content } = strips.get(s.id) ?? {};
      if (!el || !content) continue;
      place(el, s.rect);
      place(content, {
        x: -s.rect.x,
        y: -s.rect.y,
        width: s.rect.x + s.contentWidth,
        height: s.rect.y + s.rect.height,
      });
    }
  };

  const onMove = (ev: PointerEvent) => {
    pointer = row ? ev.clientX : ev.clientY;
    if (!raf) raf = requestAnimationFrame(render);
  };

  let done = false;
  let disown = () => {};
  const finish = (commitIt: boolean) => {
    if (done) return;
    done = true;
    disown();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (commitIt) render(); // flush the last pointer position, so the commit equals what was last shown
    else {
      pointer = start;
      snapped = false;
      render();
    }
    sepEl.removeEventListener("pointermove", onMove);
    sepEl.removeEventListener("pointerup", onUp);
    sepEl.removeEventListener("pointercancel", onCancel);
    sepEl.removeEventListener("lostpointercapture", onUp);
    window.removeEventListener("keydown", onKey, true);
    try {
      sepEl.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    store.dom.setDragging(null, sepEl);
    line?.hide();
    for (const release of held) release();
    // One commit, one URL write (120ms after the drag settles). React re-renders only the frames whose rect changed,
    // with the values already on screen.
    if (commitIt && preview !== layout0 && store.get().layout === layout0)
      store.actions.commitDividerDrag(preview, parentId, index);
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(false);
  };

  sepEl.addEventListener("pointermove", onMove);
  sepEl.addEventListener("pointerup", onUp);
  sepEl.addEventListener("pointercancel", onCancel);
  sepEl.addEventListener("lostpointercapture", onUp);
  window.addEventListener("keydown", onKey, true);
  // The drag belongs to the instance: stopping or destroying it mid-drag cancels the drag, as Escape would, so its
  // listeners, the held content and the page's resize cursor never outlive it.
  disown = store.gesture(() => finish(false));
}
