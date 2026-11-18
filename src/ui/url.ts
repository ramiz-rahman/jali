/**
 * URL sync, through a location port (ui/ports.ts). Structure goes in ?l= (layout-core codec); zoom and peek ride along. Deliberate structural changes push a
 * history entry; resizes replace it 120ms after the last move; view changes replace immediately.
 */
import * as core from "../layout-core";
import type { KindRegistry, Layout, ObjectRef, ViewState } from "../layout-core/types";
import type { HistoryMode } from "./state/apply";
import type { UiState, UrlWriter } from "./state/store";
import { browserLocation, browserStorage, type LocationPort, type StoragePort } from "./ports";

export const PERSIST_MS = 120;
const BROKEN_KEY = "broken-layout";

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

/**
 * The search params a workspace owns. Every other param in the address is the host's and is kept as it is. `prefix`
 * names them apart when two workspaces share one address (`{ prefix: "w2." }` writes `w2.l`, `w2.zoom`, ...).
 */
export interface UrlKeys { layout: string; zoom: string; peek: string; app: string; item: string; tab: string; open: string }
export function urlKeys(prefix = ""): UrlKeys {
  return { layout: `${prefix}l`, zoom: `${prefix}zoom`, peek: `${prefix}peek`, app: `${prefix}app`, item: `${prefix}item`, tab: `${prefix}tab`, open: `${prefix}open` };
}

/**
 * A curated page's link carries content only: the item, the view in use and the panes opened while investigating.
 * The mode and the multiplexed layout are the reader's own, so the same link opens in each person's way of working.
 */
function reviewParams(q: URLSearchParams, s: UiState, k: UrlKeys) {
  q.delete(k.layout);
  for (const key of [k.app, k.item, k.tab, k.open, "arr"]) q.delete(key);
  if (!s.review) return;
  q.set(k.app, "review");
  q.set(k.item, String(s.review.item));
  const focused = core.tree.panes(s.layout.root).find((p) => p.id === s.view.focused)?.role;
  q.set(k.tab, s.review.mode === "single" ? s.review.tab : focused ?? s.review.tab);
  for (const p of core.tree.panes(s.layout.root)) if (!p.role) q.append(k.open, encodePeek(p.ref));
}

/** The search string for `s`, keeping every param of `search` that is not the workspace's. */
export function buildSearch(search: string, s: UiState, k: UrlKeys = urlKeys()): string {
  const q = new URLSearchParams(search);
  reviewParams(q, s, k);
  if (!s.review) q.set(k.layout, core.encode(s.layout));
  if (s.view.zoomed) q.set(k.zoom, s.view.zoomed); else q.delete(k.zoom);
  if (s.view.peek) q.set(k.peek, encodePeek(s.view.peek)); else q.delete(k.peek);
  const text = q.toString();
  return text ? `?${text}` : "";
}

/** What the address holds: a layout and view, or a code that could not be read. Null when there is no layout. */
export interface ReviewRead { tab: string; item: number; investigation: ObjectRef[] }
export type UrlRead = { layout: Layout; view: Partial<ViewState> } | { broken: string; view: Partial<ViewState> } | { review: ReviewRead; view: Partial<ViewState> };

export function readSearch(search: string, kinds: KindRegistry, k: UrlKeys = urlKeys()): UrlRead | null {
  const q = new URLSearchParams(search);
  const code = q.get(k.layout);
  const view: Partial<ViewState> = {};
  const peek = q.get(k.peek);
  const ref = peek ? decodePeek(peek) : null;
  if (ref) view.peek = ref;
  if (q.get(k.app) === "review") {
    const item = Number(q.get(k.item));
    const investigation = q.getAll(k.open).map(decodePeek).filter((r): r is ObjectRef => !!r && Object.hasOwn(kinds, r.kind));
    return { review: { tab: q.get(k.tab) ?? "", item: Number.isInteger(item) && item > 0 ? item : 0, investigation }, view };
  }
  if (!code) return null;
  const layout = core.decode(code, kinds);
  if (!layout) return { broken: code, view: {} };
  const zoom = q.get(k.zoom);
  if (zoom && core.tree.panes(layout.root).some((p) => p.id === zoom)) view.zoomed = zoom;
  return { layout, view };
}

export interface UrlSync extends UrlWriter {
  read(kinds: KindRegistry): UrlRead | null;
  /** Keep a copy of a link that could not be read. */
  keepBroken(code: string): void;
  onPop(fn: () => void): () => void;
  href(): string;
}

export interface UrlSyncOptions {
  /** The address: the browser's history by default, or a router adapter (ui/ports.ts). */
  location?: LocationPort;
  /** Where a link that could not be read is kept. Default: localStorage under "jali". */
  storage?: StoragePort;
  /** Prefix for the workspace's search params, when two workspaces share an address. */
  prefix?: string;
}

export function createUrlSync({ location = browserLocation(), storage = browserStorage("jali"), prefix }: UrlSyncOptions = {}): UrlSync {
  const keys = urlKeys(prefix);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = (s: UiState, push: boolean) => {
    const next = buildSearch(location.search(), s, keys);
    if (next === location.search()) return;
    location.navigate(next, push ? "push" : "replace");
  };
  return {
    // A debounced write reads the state when it fires, so it writes the latest sizes.
    write(state: () => UiState, mode: HistoryMode) {
      if (mode === "none") return;
      clearTimeout(timer);
      if (mode === "debounce") timer = setTimeout(() => write(state(), false), PERSIST_MS);
      else write(state(), mode === "push");
    },
    read: (kinds) => readSearch(location.search(), kinds, keys),
    keepBroken: (code) => storage.set(BROKEN_KEY, code),
    onPop: (fn) => location.subscribe(fn),
    href: () => location.href(),
  };
}
