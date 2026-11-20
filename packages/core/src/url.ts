/**
 * URL sync, through a location port (ports.ts). Structure goes in ?l= (layout/codec); zoom, peek and the preset the
 * layout came from ride along. Deliberate structural changes push a
 * history entry; resizes replace it 120ms after the last move; view changes replace immediately.
 */
import * as core from "./layout";
import type {
  KindRegistry,
  Layout,
  LayoutNode,
  NodeId,
  ObjectRef,
  ViewState,
} from "./layout/types";
import type { HistoryMode } from "./state/apply";
import type { UiState, UrlWriter } from "./state/store";
import { browserLocation, browserStorage, type LocationPort, type StoragePort } from "./ports";
import { own as ownOf } from "./own";

export const PERSIST_MS = 120;
const BROKEN_KEY = "broken-layout";

/**
 * A ref as text, for `peek=` and a page's `open=`: `record~table=orders~id=#42~draft=!true`. A number is marked `#`
 * and a flag `!`, so both come back as they went; text is written as it is.
 */
export function encodePeek(ref: ObjectRef): string {
  const params = Object.entries(ref.params).map(
    ([k, v]) => `${k}=${typeof v === "number" ? `#${v}` : typeof v === "boolean" ? `!${v}` : v}`,
  );
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
    params[p.slice(0, i)] =
      v.startsWith("#") && v.length > 1 && !Number.isNaN(Number(v.slice(1)))
        ? Number(v.slice(1))
        : v === "!true" || v === "!false"
          ? v === "!true"
          : v;
  }
  return { kind, params };
}

/** A ref from a link that its kind can read; an unknown kind is kept (the pane says so), unreadable params are not. */
const readable = (kinds: KindRegistry, ref: ObjectRef) =>
  !Object.hasOwn(kinds, ref.kind) || !kinds[ref.kind]!.checkParams?.(ref.params);

/**
 * The search params a workspace owns. Every other param in the address is the host's and is kept as it is. `prefix`
 * names them apart when two workspaces share one address (`{ prefix: "w2." }` writes `w2.l`, `w2.zoom`, ...).
 */
export interface UrlKeys {
  layout: string;
  zoom: string;
  peek: string;
  page: string;
  item: string;
  tab: string;
  open: string;
  preset: string;
  scroll: string;
}
export function urlKeys(prefix = ""): UrlKeys {
  return {
    layout: `${prefix}l`,
    zoom: `${prefix}zoom`,
    peek: `${prefix}peek`,
    page: `${prefix}page`,
    item: `${prefix}item`,
    tab: `${prefix}tab`,
    open: `${prefix}open`,
    preset: `${prefix}preset`,
    scroll: `${prefix}scroll`,
  };
}

/**
 * A curated page's link carries content only: the item, the view in use and the panes opened while investigating.
 * The mode and the split layout are the reader's own, so the same link opens in each person's way of working.
 */
function pageParams(q: URLSearchParams, s: UiState, k: UrlKeys) {
  q.delete(k.layout);
  for (const key of [k.page, k.item, k.tab, k.open, k.preset, "app", "arr"]) q.delete(key);
  if (!s.page) return;
  q.set(k.page, s.page.profile);
  q.set(k.item, String(s.page.item));
  const focused = core.tree.panes(s.layout.root).find((p) => p.id === s.view.focused)?.role;
  q.set(k.tab, s.page.mode === "single" ? s.page.tab : (focused ?? s.page.tab));
  for (const p of core.tree.panes(s.layout.root)) if (!p.role) q.append(k.open, encodePeek(p.ref));
}

/** The search string for `s`, keeping every param of `search` that is not the workspace's. */
export function buildSearch(search: string, s: UiState, k: UrlKeys = urlKeys()): string {
  const q = new URLSearchParams(search);
  pageParams(q, s, k);
  if (!s.page) q.set(k.layout, core.encode(s.layout));
  // The preset the layout came from, so a link marks the right one and Reset rebuilds it. Only beside a layout.
  if (!s.page && s.presetId) q.set(k.preset, s.presetId);
  if (s.view.zoomed) q.set(k.zoom, s.view.zoomed);
  else q.delete(k.zoom);
  if (s.view.peek) q.set(k.peek, encodePeek(s.view.peek));
  else q.delete(k.peek);
  // Rows that scroll sideways, where each came to rest: `week:732`, comma-separated. None at their start.
  const scroll = Object.entries(s.view.scroll ?? {}).filter(([, v]) => Math.round(v) > 0);
  if (!s.page && scroll.length)
    q.set(k.scroll, scroll.map(([id, v]) => `${id}:${Math.round(v)}`).join(","));
  else q.delete(k.scroll);
  const text = q.toString();
  return text ? `?${text}` : "";
}

/** What the address holds: a layout and view, or a code that could not be read. Null when there is no layout. */
/** A page link: its view, its item as the link wrote it (text; the page converts it to its profile's type), and the
 *  panes opened while investigating. `item` is undefined when the link names none. */
export interface PageRead {
  tab: string;
  item: string | undefined;
  investigation: ObjectRef[];
}
/** `preset`: the preset a layout link says it came from (`?preset=`), when it names one. */
export type UrlRead =
  | { layout: Layout; view: Partial<ViewState>; preset?: string }
  | { broken: string; view: Partial<ViewState>; preset?: string }
  | { page: PageRead; view: Partial<ViewState> };

export function readSearch(
  search: string,
  kinds: KindRegistry,
  k: UrlKeys = urlKeys(),
): UrlRead | null {
  const q = new URLSearchParams(search);
  const code = q.get(k.layout);
  const view: Partial<ViewState> = {};
  const peek = q.get(k.peek);
  const ref = peek ? decodePeek(peek) : null;
  if (ref && readable(kinds, ref)) view.peek = ref;
  // `?app=review` is the old combined lab app's form from before pages had ids (19 Nov 2026).
  if (q.get(k.page) || q.get("app") === "review") {
    const item = q.get(k.item) || undefined;
    const investigation = q
      .getAll(k.open)
      .map(decodePeek)
      .filter((r): r is ObjectRef => !!r && Object.hasOwn(kinds, r.kind) && readable(kinds, r));
    return { page: { tab: q.get(k.tab) ?? "", item, investigation }, view };
  }
  if (!code) return null;
  const preset = q.get(k.preset) || undefined;
  const named = preset ? { preset } : {};
  const layout = core.decode(code, kinds);
  if (!layout) return { broken: code, view: {}, ...named };
  const zoom = q.get(k.zoom);
  // Only a pane on screen can be maximised: one the layout hides is left unzoomed.
  if (
    zoom &&
    core.tree.panes(layout.root).some((p) => p.id === zoom) &&
    !layout.overlay?.hidden?.includes(zoom)
  )
    view.zoomed = zoom;
  const scroll = readScroll(q.get(k.scroll), layout);
  if (scroll) view.scroll = scroll;
  return { layout, view, ...named };
}

/** `week:732,board:40`: offsets for rows of `layout` that scroll sideways. Anything else in it is left out. */
function readScroll(text: string | null, layout: Layout): Record<NodeId, number> | undefined {
  if (!text) return undefined;
  const out: Record<NodeId, number> = Object.create(null);
  for (const part of text.split(",")) {
    const at = part.lastIndexOf(":");
    const id = part.slice(0, at),
      value = Number(part.slice(at + 1));
    const node = at > 0 ? core.tree.find(layout.root, id) : undefined;
    if (node?.type !== "row" || node.scroll !== "x" || !Number.isFinite(value) || value < 0)
      continue;
    out[id] = Math.round(value);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * What a layout link carries about sizes. "link": everything, so the link reopens exactly as it was.
 * "local": the layout as designed; sizes the person dragged stay on their device, keyed by the layout's structure,
 * so their own reloads keep them and a colleague opens the link at the designed proportions.
 */
export type LinkSizes = "link" | "local";

/** A node's sizes, as the person left them. */
export type PersonalSizes = Record<NodeId, Pick<LayoutNode, "size" | "base" | "userSized">>;

/** The layout with every divider the person moved put back (each node's `base`, else an equal share), and those sizes. */
export function splitPersonalSizes(layout: Layout): { layout: Layout; sizes: PersonalSizes } {
  const sizes: PersonalSizes = Object.create(null);
  const strip = (n: LayoutNode): LayoutNode => {
    const out = { ...n } as LayoutNode;
    if (n.base !== undefined || n.userSized) {
      sizes[n.id] = {
        size: n.size,
        ...(n.base ? { base: n.base } : {}),
        ...(n.userSized ? { userSized: true } : {}),
      };
      out.size = n.base ?? { weight: 1 };
      delete out.base;
      delete out.userSized;
    }
    if (out.type !== "pane")
      (out as Exclude<LayoutNode, { type: "pane" }>).children = (
        out as Exclude<LayoutNode, { type: "pane" }>
      ).children.map(strip);
    return out;
  };
  return { layout: { ...layout, root: strip(layout.root) }, sizes };
}

/** One positive px or weight, as a node's size holds it. */
const isSize = (v: unknown): v is LayoutNode["size"] => {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).length !== 1) return false;
  const n = (v as { px?: unknown; weight?: unknown }).px ?? (v as { weight?: unknown }).weight;
  return typeof n === "number" && Number.isFinite(n) && n > 0;
};

/** The part of a stored entry that is a node's sizes: `size` and `base` that are sizes, and `userSized: true`.
 *  Anything else in it (a `ref`, `children`, another type) is left out; undefined when nothing is left. */
function sizesOf(entry: unknown): PersonalSizes[NodeId] | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const e = entry as Record<string, unknown>;
  const out: PersonalSizes[NodeId] = {} as PersonalSizes[NodeId];
  if (isSize(e.size)) out.size = { ...e.size };
  if (isSize(e.base)) out.base = { ...e.base };
  if (e.userSized === true) out.userSized = true;
  return Object.keys(out).length ? out : undefined;
}

/** `layout` with the person's sizes put back on the nodes that still exist. Only sizes are taken from `sizes`, and
 *  only values a size can hold; anything else stored there is left out. */
export function joinPersonalSizes(layout: Layout, sizes: PersonalSizes): Layout {
  const put = (n: LayoutNode): LayoutNode => {
    const own = sizesOf(ownOf(sizes, n.id));
    const out = (own ? { ...n, ...own } : { ...n }) as LayoutNode;
    if (out.type !== "pane")
      (out as Exclude<LayoutNode, { type: "pane" }>).children = (
        out as Exclude<LayoutNode, { type: "pane" }>
      ).children.map(put);
    return out;
  };
  return { ...layout, root: put(layout.root) };
}

/** The layout's shape (ids, types and what each pane shows), so sizes kept for one layout never land on another. */
export function structureKey(layout: Layout): string {
  const sig = (n: LayoutNode): unknown =>
    n.type === "pane" ? [n.id, n.ref.kind, n.ref.params] : [n.id, n.type, n.children.map(sig)];
  const text = JSON.stringify(sig(layout.root));
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export interface UrlSync extends UrlWriter {
  read(kinds: KindRegistry): UrlRead | null;
  /** Keep a copy of a link that could not be read. */
  keepBroken(code: string): void;
  onPop(fn: () => void): () => void;
  href(): string;
}

export interface UrlSyncOptions {
  /** The address: the browser's history by default, or a router adapter (ports.ts). */
  location?: LocationPort;
  /** Where a link that could not be read is kept (and, in "local" mode, the sizes dragged), under keys that start
   *  with `prefix`. Default: localStorage under "jali". */
  storage?: StoragePort;
  /** Prefix for the workspace's search params, when two workspaces share an address. */
  prefix?: string;
  /** What a layout link carries about sizes (LinkSizes). Default "local": the layout as designed. */
  sizes?: LinkSizes;
}

export function createUrlSync({
  location = browserLocation(),
  storage = browserStorage("jali"),
  prefix,
  sizes = "local",
}: UrlSyncOptions = {}): UrlSync {
  const keys = urlKeys(prefix);
  const sizesKey = `${prefix ?? ""}sizes`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // "local": the sizes the person dragged, per layout structure (a few layouts, most recent first).
  const loadSizes = (): [string, PersonalSizes][] => {
    try {
      const v: unknown = JSON.parse(storage.get(sizesKey) ?? "[]");
      if (!Array.isArray(v)) return [];
      return v.filter(
        (e): e is [string, PersonalSizes] =>
          Array.isArray(e) && typeof e[0] === "string" && !!e[1] && typeof e[1] === "object",
      );
    } catch {
      return [];
    }
  };
  const keepSizes = (layout: Layout, own: PersonalSizes) => {
    const key = structureKey(layout);
    const rest = loadSizes().filter(([k]) => k !== key);
    const next = Object.keys(own).length ? [[key, own] as [string, PersonalSizes], ...rest] : rest;
    storage.set(sizesKey, JSON.stringify(next.slice(0, 12)));
  };
  const write = (s0: UiState, push: boolean) => {
    let s = s0;
    if (sizes === "local" && !s.page) {
      const split = splitPersonalSizes(s.layout);
      keepSizes(split.layout, split.sizes);
      s = { ...s, layout: split.layout };
    }
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
    read(kinds) {
      const r = readSearch(location.search(), kinds, keys);
      if (sizes !== "local" || !r || !("layout" in r)) return r;
      const own = loadSizes().find(([k]) => k === structureKey(r.layout))?.[1];
      if (!own) return r;
      // The person's sizes are checked as the link was: a layout they would break opens as the link has it.
      const joined = joinPersonalSizes(r.layout, own);
      return core.validate(joined, kinds).ok ? { ...r, layout: joined } : r;
    },
    keepBroken: (code) => storage.set(`${prefix ?? ""}${BROKEN_KEY}`, code),
    onPop: (fn) => location.subscribe(fn),
    href: () => location.href(),
  };
}
