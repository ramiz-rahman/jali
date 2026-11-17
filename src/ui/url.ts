/**
 * URL sync. Structure goes in ?l= (layout-core codec); zoom and peek ride along. Deliberate structural changes push a
 * history entry; resizes replace it 120ms after the last move; view changes replace immediately.
 */
import * as core from "../layout-core";
import type { KindRegistry, Layout, ObjectRef, ViewState } from "../layout-core/types";
import type { HistoryMode } from "./state/apply";
import type { UiState, UrlWriter } from "./state/store";

export const PERSIST_MS = 120;
const BROKEN_KEY = "pane-lab:broken-layout";

export function encodePeek(ref: ObjectRef): string {
  const params = Object.entries(ref.params).map(([k, v]) => `${k}=${typeof v === "number" ? `#${v}` : v}`);
  return [ref.kind, ...params].join("~");
}
export function decodePeek(text: string): ObjectRef | null {
  const [kind, ...rest] = text.split("~");
  if (!kind) return null;
  const params: ObjectRef["params"] = {};
  for (const p of rest) {
    const i = p.indexOf("=");
    if (i < 1) return null;
    const v = p.slice(i + 1);
    params[p.slice(0, i)] = v.startsWith("#") && v.length > 1 && !Number.isNaN(Number(v.slice(1))) ? Number(v.slice(1)) : v;
  }
  return { kind, params };
}

const REVIEW_KEYS = ["app", "arr", "item", "tab", "open"];

/**
 * A curated page's link carries content only: the item, the view in use and the panes opened while investigating.
 * The mode and the multiplexed layout are the reader's own, so the same link opens in each person's way of working.
 */
function reviewParams(q: URLSearchParams, s: UiState) {
  q.delete("l");
  for (const k of REVIEW_KEYS) q.delete(k);
  if (!s.review) return;
  q.set("app", "review");
  q.set("item", String(s.review.item));
  const focused = core.tree.panes(s.layout.root).find((p) => p.id === s.view.focused)?.role;
  q.set("tab", s.review.mode === "single" ? s.review.tab : focused ?? s.review.tab);
  for (const p of core.tree.panes(s.layout.root)) if (!p.role) q.append("open", encodePeek(p.ref));
}

function buildUrl(s: UiState): string {
  const q = new URLSearchParams(location.search);
  reviewParams(q, s);
  if (!s.review) q.set("l", core.encode(s.layout));
  if (s.view.zoomed) q.set("zoom", s.view.zoomed); else q.delete("zoom");
  if (s.view.peek) q.set("peek", encodePeek(s.view.peek)); else q.delete("peek");
  return `${location.pathname}?${q.toString()}${location.hash}`;
}

/** What the address bar holds: a layout and view, or a code that could not be read. Null when there is no layout. */
export interface ReviewRead { tab: string; item: number; investigation: ObjectRef[] }
export type UrlRead = { layout: Layout; view: Partial<ViewState> } | { broken: string; view: Partial<ViewState> } | { review: ReviewRead; view: Partial<ViewState> };

export function readUrl(kinds: KindRegistry): UrlRead | null {
  const q = new URLSearchParams(location.search);
  const code = q.get("l");
  const view: Partial<ViewState> = {};
  const peek = q.get("peek");
  const ref = peek ? decodePeek(peek) : null;
  if (ref) view.peek = ref;
  if (q.get("app") === "review") {
    const item = Number(q.get("item"));
    const investigation = q.getAll("open").map(decodePeek).filter((r): r is ObjectRef => !!r && Object.hasOwn(kinds, r.kind));
    return { review: { tab: q.get("tab") ?? "", item: Number.isInteger(item) && item > 0 ? item : 0, investigation }, view };
  }
  if (!code) return null;
  const layout = core.decode(code, kinds);
  if (!layout) return { broken: code, view: {} };
  const zoom = q.get("zoom");
  if (zoom && core.tree.panes(layout.root).some((p) => p.id === zoom)) view.zoomed = zoom;
  return { layout, view };
}

export interface UrlSync extends UrlWriter {
  read(kinds: KindRegistry): UrlRead | null;
  /** Keep a copy of a link that could not be read. */
  keepBroken(code: string): void;
  onPop(fn: () => void): () => void;
}

export function createUrlSync(): UrlSync {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = (s: UiState, push: boolean) => {
    const url = buildUrl(s);
    if (url === location.pathname + location.search + location.hash) return;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
  };
  return {
    // A debounced write reads the state when it fires, so it writes the latest sizes.
    write(state: () => UiState, mode: HistoryMode) {
      if (mode === "none") return;
      clearTimeout(timer);
      if (mode === "debounce") timer = setTimeout(() => write(state(), false), PERSIST_MS);
      else write(state(), mode === "push");
    },
    read: readUrl,
    keepBroken(code) {
      try { localStorage.setItem(BROKEN_KEY, code); } catch { /* ignore */ }
    },
    onPop(fn) {
      window.addEventListener("popstate", fn);
      return () => window.removeEventListener("popstate", fn);
    },
  };
}
