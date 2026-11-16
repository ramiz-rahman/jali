/**
 * Divider pointer drag: presentation separate from the model (Rex).
 *
 * Pointer down captures the pointer and snapshots the committed layout. Each animation frame (at most one per frame)
 * turns the pointer into the first neighbour's size (clamped at both minimums, centre snap in at 10px, out at 16px),
 * asks layout-core for the layout that size gives, resolves it, and writes the result straight onto the DOM:
 * the affected pane frames' left/top/width/height, and the accent drag line. No React state changes during the drag.
 * Pointer up commits that same layout object once, so the committed rects equal the last preview exactly; the URL is
 * written 120ms later (history "debounce"). Heavy panes hold their content at its pre-drag size and reflow on release.
 */
import type { DividerBox, Layout, NodeId, PaneBox, Rect, ResolvedLayout, SplitNode } from "../../layout-core/types";
import { core } from "../core";
import { pairGeometry, type PairGeometry } from "../geometry";
import { paneDomId } from "../ids";
import { getPaneKind } from "../pane-kinds";
import { actions, findNode, fit, GAP, getState, resolved, titleOf } from "../store";

export const SNAP_IN = 10;
export const SNAP_OUT = 16;

/** Pure snap with hysteresis, exported for tests. */
export function snap(size: number, centre: number, wasSnapped: boolean): { size: number; snapped: boolean } {
  const d = Math.abs(size - centre);
  const snapped = wasSnapped ? d <= SNAP_OUT : d <= SNAP_IN;
  return { size: snapped ? centre : size, snapped };
}

export function clampSize(size: number, min: number, max: number) {
  return Math.max(min, Math.min(max, size));
}

function label(ids: string[]) {
  return ids.length === 1 ? titleOf(ids[0]) : `${titleOf(ids[0])} and ${ids.length - 1} more`;
}

export function geometryFor(d: DividerBox, r: ResolvedLayout = resolved()): PairGeometry | null {
  const parent = findNode(d.parentId);
  const split = parent && (parent.type === "row" || parent.type === "column") ? (parent as SplitNode) : undefined;
  return pairGeometry(d, split, r.panes, fit().kinds, GAP, label);
}

export const dividerKey = (d: { parentId: NodeId; index: number }) => `${d.parentId}:${d.index}`;

/** The one drag line, owned by DividerLayer. */
let overlay: HTMLElement | null = null;
export function setDragOverlay(el: HTMLElement | null) {
  overlay = el;
}

let active: { cancel(): void } | null = null;
/** True while a pointer drag is in progress (keyboard resizes wait). */
export const isDividerDragging = () => !!active;

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
function place(el: HTMLElement, r: Rect) {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
}

export function startDividerDrag(e: { pointerId: number; button: number; clientX: number; clientY: number; currentTarget: EventTarget | null }, parentId: NodeId, index: number) {
  if (e.button !== 0 || active) return;
  const sepEl = e.currentTarget as HTMLElement | null;
  const s0 = getState();
  if (!sepEl || s0.view.zoomed) return;
  const r0 = resolved();
  const d0 = r0.dividers.find((d) => d.parentId === parentId && d.index === index);
  const g0 = d0 && geometryFor(d0, r0);
  if (!d0 || !g0) return;

  const layout0 = s0.layout, view0 = s0.view, fit0 = fit();
  const row = g0.axis === "row";
  const start = row ? e.clientX : e.clientY;
  const min = g0.a.min, max = g0.divider.max, centre = g0.total / 2;
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
    const el = document.getElementById(paneDomId(b.id));
    if (el) frames.set(b.id, el);
  }
  const dividerEls = new Map<string, HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>(".divider-layer [data-divider]")) {
    // Only our own separator is positioned by its gap rect; Ark's sits inside a ghost group and moves on commit.
    if (el.style.position === "absolute") dividerEls.set(el.dataset.divider!, el);
  }
  const neighbours = new Set([...(d0.neighbours?.[0] ?? g0.a.ids), ...(d0.neighbours?.[1] ?? g0.b.ids)]);

  // Heavy panes hold their content at its current size; the frame around it still moves with the pointer.
  const held: { content: HTMLElement; inner: HTMLElement }[] = [];
  for (const id of neighbours) {
    const box = before.get(id), frame = frames.get(id);
    const node = findNode(id);
    if (!box || box.hiddenInStack || !frame || node?.type !== "pane" || !getPaneKind(node.ref.kind)?.heavy) continue;
    const content = frame.querySelector<HTMLElement>(":scope > .pane-content");
    const inner = content?.querySelector<HTMLElement>(":scope > .pane-content-inner");
    if (!content || !inner || content.hidden) continue;
    const r = content.getBoundingClientRect();
    inner.style.width = `${r.width}px`;
    inner.style.height = `${r.height}px`;
    content.dataset.holding = "";
    held.push({ content, inner });
  }

  const axisCls = row ? "is-resizing-row" : "is-resizing-column";
  document.body.classList.add("is-resizing", axisCls);
  sepEl.classList.add("is-dragging");
  const tick = overlay?.querySelector<HTMLElement>(".divider-tick") ?? null;
  if (overlay) {
    overlay.className = `divider-visual divider-${g0.axis}`;
    place(overlay, d0.rect);
    overlay.hidden = false;
  }

  let pointer = start;
  let snapped = false;
  let shownSize = g0.a.size;
  let preview: Layout = layout0;
  let raf = 0;
  const written = new Set<string>();

  const render = () => {
    raf = 0;
    let size = clampSize(g0.a.size + (pointer - start), min, max);
    if (centreOk) {
      const s = snap(size, centre, snapped);
      snapped = s.snapped;
      if (snapped) size = s.size;
    } else snapped = false;
    if (tick) tick.hidden = !snapped;
    overlay?.classList.toggle("is-snapped", snapped);
    if (Math.abs(size - shownSize) < 0.01) return;
    shownSize = size;

    const delta = size - g0.a.size;
    preview = Math.abs(delta) < 0.01 ? layout0 : core.resizeDivider(layout0, parentId, index, delta, fit0);
    const r = preview === layout0 ? r0 : core.resolve(preview, view0, fit0);

    // Pane frames: only the ones whose box differs from the committed one (plus any written earlier, to restore them).
    for (const b of r.panes) {
      const was = before.get(b.id), el = frames.get(b.id);
      if (!was || !el) continue;
      if (sameRect(was.rect, b.rect) && !!was.hiddenInStack === !!b.hiddenInStack && !written.has(b.id)) continue;
      place(el, b.rect);
      el.style.display = b.hiddenInStack ? "none" : "";
      written.add(b.id);
    }
    // Dividers inside the neighbours (and the line we drag) follow the same resolve.
    const was = new Map(r0.dividers.map((d) => [dividerKey(d), d.rect]));
    for (const d of r.dividers) {
      const k = dividerKey(d);
      const el = dividerEls.get(k), w = was.get(k);
      if (k === dividerKey(d0)) {
        if (overlay) place(overlay, d.rect);
        continue;
      }
      if (el && w && (!sameRect(w, d.rect) || written.has(k))) {
        place(el, d.rect);
        written.add(k);
      }
    }
  };

  const onMove = (ev: PointerEvent) => {
    pointer = row ? ev.clientX : ev.clientY;
    if (!raf) raf = requestAnimationFrame(render);
  };

  const finish = (commitIt: boolean) => {
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
    document.body.classList.remove("is-resizing", axisCls);
    sepEl.classList.remove("is-dragging");
    if (overlay) overlay.hidden = true;
    for (const h of held) {
      h.inner.style.width = "";
      h.inner.style.height = "";
      delete h.content.dataset.holding;
    }
    active = null;
    // One commit, one URL write (120ms after the drag settles). React re-renders only the frames whose rect changed,
    // with the values already on screen.
    if (commitIt && preview !== layout0 && getState().layout === layout0) actions.commitDividerDrag(preview);
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
  active = { cancel: onCancel };
}
