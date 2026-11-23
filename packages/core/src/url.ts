/**
 * URL sync, through a location port (ports.ts). Structure goes in ?l= (layout/codec); zoom, scroll and the preset the
 * layout came from ride along. The peek never does: a reload closes it. Deliberate structural changes push a
 * history entry; resizes replace it 120ms after the last move; view changes replace it. Replaces are written at most
 * once per 250 ms (browsers refuse more than about 100 history writes in 10 s), the latest winning.
 */
import * as core from "./layout/engine";
import type {
  KindRegistry,
  Layout,
  LayoutNode,
  NodeId,
  ObjectRef,
  ViewState,
} from "./layout/types";
import type { HistoryMode } from "./state/apply";
import type { ItemId } from "./profile";
import type { UrlState, UrlWriter } from "./state/store";
import { readLayout, readRef } from "./pane-kinds";
import { browserLocation, browserStorage, type LocationPort, type StoragePort } from "./ports";
import { own as ownOf } from "./own";
import { sameRef } from "./layout/ops/ref";
import { zoomable } from "./layout/fit/overlay";
import { fitsLink, linkUsage, MAX_LINK_TEXT, OPEN_MAX } from "./layout/codec/limits";

declare const process: { env: { NODE_ENV?: string } };

export const PERSIST_MS = 120;
/** The least time between two replaces: more in between wait, and only the latest is written. */
export const REPLACE_MS = 250;
const BROKEN_KEY = "broken-layout";
export { OPEN_MAX };

/** The characters the ref text gives a meaning to, written `%XX` inside a kind, a key or a text value. */
const escape = (text: string) =>
  text.replace(/[%~=#!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const unescape = (text: string) =>
  text.replace(/%(25|7E|3D|23|21)/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/**
 * A ref as text, for a page's `open=`: `record~table=orders~id=#42~draft=!true`. A number is marked `#`
 * and a flag `!`, so both come back as they went. In a kind, a key or a text value, `%`, `~`, `=`, `#` and `!` are
 * written `%25`, `%7E`, `%3D`, `%23` and `%21`, so any text comes back as it went (`"#123"` stays text). Text
 * without them is written as it is, so links from before read the same.
 */
export function encodeRef(ref: ObjectRef): string {
  const params = Object.entries(ref.params).map(
    ([k, v]) =>
      `${escape(k)}=${typeof v === "number" ? `#${v}` : typeof v === "boolean" ? `!${v}` : escape(v)}`,
  );
  return [escape(ref.kind), ...params].join("~");
}
export function decodeRef(text: string): ObjectRef | null {
  const [kind, ...rest] = text.split("~");
  if (!kind) return null;
  const params: [string, ObjectRef["params"][string]][] = [];
  for (const p of rest) {
    const i = p.indexOf("=");
    if (i < 1) return null;
    const v = p.slice(i + 1);
    params.push([
      unescape(p.slice(0, i)),
      v.startsWith("#") && v.length > 1 && !Number.isNaN(Number(v.slice(1)))
        ? Number(v.slice(1))
        : v === "!true" || v === "!false"
          ? v === "!true"
          : unescape(v),
    ]);
  }
  // Own keys only: a key such as `__proto__` is a param like any other.
  return { kind: unescape(kind), params: Object.fromEntries(params) };
}

/** A ref from a link that its kind can read; an unknown kind is kept (the pane says so), unreadable params are not. */
const readable = (kinds: KindRegistry, ref: ObjectRef) =>
  !Object.hasOwn(kinds, ref.kind) || !kinds[ref.kind]!.checkParams?.(ref.params);

/**
 * The search params an instance owns. Every other param in the address is the host's and is kept as it is. `prefix`
 * names them apart when two instances share one address (`{ prefix: "w2." }` writes `w2.l`, `w2.zoom`, ...).
 */
export interface UrlKeys {
  layout: string;
  zoom: string;
  /** Only removed: an older link's peek is ignored, and gone from the address at the next write. */
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
 * The old lab's page params (`?app=review`, `arr`, from before pages had ids, 19 Nov 2026) are read and cleared only by
 * the instance without a prefix: links from then never had one, and beside a prefixed instance `app` and `arr` are
 * the host's.
 */
const legacyKeys = (k: UrlKeys) => k.layout === "l";

/**
 * A curated page's link carries content only: the item, the view in use and the panes opened while investigating.
 * The mode and the split layout are the reader's own, so the same link opens in each person's way of working.
 */
function pageParams(q: URLSearchParams, s: UrlState, k: UrlKeys) {
  q.delete(k.layout);
  for (const key of [k.page, k.item, k.tab, k.open, k.preset]) q.delete(key);
  // Only an old lab link's own params go (`app=review` and its `arr`): any other `app` or `arr` is the host's.
  if (legacyKeys(k) && q.get("app") === "review") for (const key of ["app", "arr"]) q.delete(key);
  if (!s.page) return;
  const focused = core.tree.panes(s.layout.root).find((p) => p.id === s.view.focused)?.role;
  setPage(q, k, {
    page: s.page.profile,
    item: s.page.item,
    tab: s.page.mode === "single" ? s.page.tab : (focused ?? s.page.tab),
    open: core.tree.panes(s.layout.root).flatMap((p) => (p.role ? [] : [p.ref])),
  });
}

/**
 * The maximised pane as a link names it. A page's opened panes get new ids when a link is read, so one of them is named
 * by its place among the link's opened panes (`~2`, the second); a view, and any pane of a layout, by its id, a view's
 * starting with `~` escaped with another (`~~1` is the view `~1`), so every value reads back to its own pane.
 */
function zoomText(s: UrlState, id: NodeId): string {
  const at = s.page
    ? core.tree
        .panes(s.layout.root)
        .filter((p) => !p.role)
        .findIndex((p) => p.id === id)
    : -1;
  return at >= 0 ? `~${at + 1}` : s.page && id.startsWith("~") ? `~${id}` : id;
}

/** A page link's params, in the order an instance writes them. */
function setPage(q: URLSearchParams, k: UrlKeys, link: PageLink) {
  q.set(k.page, link.page);
  if (link.item !== undefined) q.set(k.item, String(link.item));
  if (link.tab !== undefined) q.set(k.tab, link.tab);
  for (const ref of link.open ?? []) q.append(k.open, encodeRef(ref));
}

/** A link to a curated page: which page, its item, the view in use and the panes opened from it. */
interface PageLink {
  /** The page's id (its profile's `id`). */
  page: string;
  /** The item it shows. Default: the one the reader saw last, else the page's first. */
  item?: ItemId;
  /** The view in use (a role id). Default: the one the reader used last, else the page's home view. */
  tab?: string;
  /** Panes opened from the page's views, in order. A link with any opens in Split view. */
  open?: readonly ObjectRef[];
}
/** The search string for `s`, keeping every param of `search` that is not the instance's. */
export function buildSearch(search: string, s: UrlState, k: UrlKeys = urlKeys()): string {
  const q = new URLSearchParams(search);
  // The instance's params all go, then come back after the host's in one order, so the same state always writes the
  // same address: a write that changes nothing makes no history entry. A peek is never in the address; an older
  // link's goes at the first write.
  for (const key of [k.zoom, k.scroll, k.peek]) q.delete(key);
  pageParams(q, s, k);
  if (!s.page) q.set(k.layout, core.encode(s.layout));
  // The preset the layout came from, so a link marks the right one and Reset rebuilds it. Only beside a layout.
  if (!s.page && s.presetId) q.set(k.preset, s.presetId);
  if (s.view.zoomed) q.set(k.zoom, zoomText(s, s.view.zoomed));
  // Rows that scroll sideways, where each came to rest: `week:732`, comma-separated. None at their start.
  const scroll = Object.entries(s.view.scroll ?? {}).filter(([, v]) => Math.round(v) > 0);
  if (!s.page && scroll.length)
    q.set(k.scroll, scroll.map(([id, v]) => `${id}:${Math.round(v)}`).join(","));
  const text = q.toString();
  return text ? `?${text}` : "";
}

/** How long the instance's own params are for `s`, as `buildSearch` writes them (its encoder: the layout's code, the
 *  page's params, zoom, scroll and the preset), the host's left out: what `MAX_LINK_TEXT` limits. */
export const linkText = (s: UrlState, k: UrlKeys = urlKeys()): number =>
  ownText(new URLSearchParams(buildSearch("", s, k)), k);

/** Whether an address for `s` could be read back whole: within every limit a link has (layout/codec/limits.ts). */
export const fitsAddress = (s: UrlState, k: UrlKeys = urlKeys()): boolean =>
  fitsLink(linkUsage(s.layout, !!s.page)) && linkText(s, k) <= MAX_LINK_TEXT;

/** A page link: its view, its item as the link wrote it (text; the page converts it to its profile's type), and the
 *  panes opened while investigating. `item` is undefined when the link names none. */
export interface PageRead {
  /** The page the link names (its profile's `id`); undefined for an old lab link (`?app=review`). */
  page?: string;
  tab: string;
  item: string | undefined;
  investigation: ObjectRef[];
  /** The opened pane the link maximised, by its place among `investigation` (from 1). */
  zoomOpened?: number;
}
/** What the address holds: a layout and view, a code that could not be read (`broken`), or a page link. `preset`: the
 *  preset a layout link says it came from (`?preset=`), when it names one. */
export type UrlRead =
  | { layout: Layout; view: Partial<ViewState>; preset?: string }
  | { broken: string; view: Partial<ViewState>; preset?: string }
  | { page: PageRead; view: Partial<ViewState> };

/** The instance's own params in `q` (never the host's, nor an older link's peek), as the address has them: what a link's
 *  text limit measures, the same way for the writer and the reader. */
function ownText(q: URLSearchParams, k: UrlKeys): number {
  const own = new Set([k.layout, k.zoom, k.page, k.item, k.tab, k.open, k.preset, k.scroll]);
  const out = new URLSearchParams();
  for (const [key, value] of q) if (own.has(key)) out.append(key, value);
  return out.toString().length;
}

export function readSearch(
  search: string,
  kinds: KindRegistry,
  k: UrlKeys = urlKeys(),
): UrlRead | null {
  const q = new URLSearchParams(search);
  const code = q.get(k.layout);
  // Longer than any address an instance writes: none of it is read (a layout link opens the fallback, a page link
  // opens the page without the panes it names).
  const tooLong = ownText(q, k) > MAX_LINK_TEXT;
  // An older link's `peek=` is ignored: a peek is never in the address.
  const view: Partial<ViewState> = {};
  // `?app=review` is the old combined lab app's form from before pages had ids (19 Nov 2026).
  if (q.get(k.page) || (legacyKeys(k) && q.get("app") === "review")) {
    const item = q.get(k.item) || undefined;
    // Each object once, in the link's order, and at most OPEN_MAX: every one is a full open and fit.
    const investigation: ObjectRef[] = [];
    // The zoom's opened pane (`~N`, zoomText): followed through what the read leaves out, to its place among those read.
    const zoom = q.get(k.zoom);
    let place = (zoom?.startsWith("~") && Number(zoom.slice(1))) || 0,
      zoomOpened = 0;
    for (const text of tooLong ? [] : q.getAll(k.open)) {
      place--;
      // A hand-made link may name more than an instance writes: the first OPEN_MAX are read.
      if (investigation.length >= OPEN_MAX) break;
      const read = decodeRef(text);
      if (!read || !Object.hasOwn(kinds, read.kind) || !readable(kinds, read)) continue;
      // A link never sets a param only the app sets (`appOnly`): every ref read from it is without them.
      const r = readRef(kinds, read);
      // Each object once (`sameRef`: the same kind and params, in any key order); a scratch kind's panes are each
      // their own, so each opened one comes back.
      if (!kinds[r.kind]!.scratch && investigation.some((x) => sameRef(x, r))) continue;
      investigation.push(r);
      if (!place) zoomOpened = investigation.length;
    }
    const page = q.get(k.page) || undefined;
    // Checked once the page's layout is built (`page.open`): only a pane it shows can be maximised.
    if (zoom && (!zoom.startsWith("~") || zoom.startsWith("~~")))
      view.zoomed = zoom.startsWith("~~") ? zoom.slice(1) : zoom;
    return {
      page: {
        ...(page ? { page } : {}),
        tab: q.get(k.tab) ?? "",
        item,
        investigation,
        ...(zoomOpened ? { zoomOpened } : {}),
      },
      view,
    };
  }
  if (!code) return null;
  const preset = q.get(k.preset) || undefined;
  const named = preset ? { preset } : {};
  const decoded = tooLong ? null : core.decode(code, kinds);
  if (!decoded) return { broken: code, view: {}, ...named };
  const layout = readLayout(kinds, decoded);
  const zoom = q.get(k.zoom);
  // Only a pane on screen can be maximised: one the layout hides is left unzoomed.
  if (zoomable(layout, zoom)) view.zoomed = zoom;
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
/** A copy of the tree under `n`, each node's copy made by `copy`. */
function copyTree(n: LayoutNode, copy: (n: LayoutNode) => LayoutNode): LayoutNode {
  const out = copy(n);
  if (out.type !== "pane")
    (out as { children: LayoutNode[] }).children = out.children.map((c) => copyTree(c, copy));
  return out;
}

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
    return out;
  };
  return { layout: { ...layout, root: copyTree(layout.root, strip) }, sizes };
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
  const put = (n: LayoutNode) => ({ ...n, ...sizesOf(ownOf(sizes, n.id)) }) as LayoutNode;
  return { ...layout, root: copyTree(layout.root, put) };
}

/** The layout's shape (ids, types and what each pane shows), so sizes kept for one layout never land on another. */
export function structureKey(layout: Layout): string {
  // Params in key order, so a layout read back from storage that reorders keys (Postgres `jsonb`) keeps its sizes.
  const params = (p: ObjectRef["params"]) =>
    Object.keys(p)
      .sort()
      .map((k) => [k, p[k]]);
  const sig = (n: LayoutNode): unknown =>
    n.type === "pane"
      ? [n.id, n.ref.kind, params(n.ref.params)]
      : [n.id, n.type, n.children.map(sig)];
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
  /** A gesture holds the instance (`true`): a write waiting stays unwritten. Released (`false`): the write waiting is
   *  dropped, and the answer says whether there was one, so the instance writes its final state instead. */
  hold(on: boolean): boolean;
  /** How long this writer's own params would be in the address for `s`, as it writes them (its sizes setting
   *  included): the instance refuses an action past `MAX_LINK_TEXT` by it. */
  measure(s: UrlState): number;
  /** The instance's kinds, read when it writes: an address is written only once the reader would read it back whole
   *  with them (a param its kind can't read makes a layout link unreadable). The instance calls this once. */
  readWith(kinds: () => KindRegistry): void;
}

export interface UrlSyncOptions {
  /** The address: the browser's history by default, or a router adapter (ports.ts). */
  location?: LocationPort;
  /** Where a link that could not be read is kept (and, in "local" mode, the sizes dragged), under keys that start
   *  with `prefix`. Default: localStorage under "jali". */
  storage?: StoragePort;
  /** Prefix for the instance's search params, when two instances share an address. */
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
  /** The replace waiting for its slot: this instance's share of the address as it was asked for, merged into the
   *  address as it is when written, so what another instance wrote meanwhile stays. */
  let waiting: UrlState | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** When the last replace was written. */
  let replaced = -Infinity;
  // Cancelled for good (`jali.destroy()`): later writes are dropped, so none lands on the next route's address.
  let closed = false;
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
  /** What of `s` the address holds (in "local", without the sizes kept on the device), and those sizes. */
  const project = (s: UrlState): [UrlState, PersonalSizes | undefined] => {
    if (sizes !== "local" || s.page) return [s, undefined];
    const split = splitPersonalSizes(s.layout);
    return [{ ...s, layout: split.layout }, split.sizes];
  };
  let warned = false;
  let kindsNow: (() => KindRegistry) | undefined;
  /** Whether the reader, with the instance's kinds, reads the address for `s` back whole: a layout link as a layout, a
   *  page link with every pane it opens. Without the kinds (a writer no instance told them), only the limits count. */
  const readsBack = (s: UrlState) => {
    if (!kindsNow) return true;
    const r = readSearch(buildSearch("", s, keys), kindsNow(), keys);
    if (!s.page) return !!r && "layout" in r;
    const opened = core.tree.panes(s.layout.root).filter((p) => !p.role).length;
    return !!r && "page" in r && r.page.investigation.length === opened;
  };
  /** The same, keeping the sizes on the device; undefined (nothing written, nothing kept) when the address would be
   *  one no instance reads back whole. It never is from an action (they are refused first): only from a start-up
   *  layout the app gave (larger than a link, or with a param its kind can't read), which opens all the same, its
   *  address left as it was. */
  const linked = (s: UrlState): UrlState | undefined => {
    const [out, own] = project(s);
    if (!fitsAddress(out, keys) || !readsBack(out)) {
      // Development only, behind the literal test a production build drops (dev.ts).
      try {
        if (process.env.NODE_ENV !== "production" && !warned)
          console.warn(
            "Jali: the layout is one a link can't reopen; the address is left as it was",
          );
      } catch {
        /* no `process`: production */
      }
      warned = true;
      return undefined;
    }
    if (own) keepSizes(out.layout, own);
    return out;
  };
  /** The address with this instance's params from `s`, keeping everyone else's. */
  const search = (s: UrlState) => buildSearch(location.search(), s, keys);
  /** Write `next` unless the address says it already, and say whether it wrote. */
  const go = (next: string, mode: "push" | "replace") => {
    if (next === location.search()) return false;
    location.navigate(next, mode);
    return true;
  };
  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  /** Write the replace waiting, now. Only a write takes the slot: one that changes nothing (an action the address
   *  doesn't hold) leaves the next its turn at once, so a reload right after still reopens what is on screen (Chrome
   *  takes a reload's address before the page hears it is leaving). */
  const flush = () => {
    const s = waiting;
    drop();
    if (s && go(search(s), "replace")) replaced = Date.now();
  };
  const schedule = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(flush, Math.max(0, ms));
  };
  /** Drop the replace waiting, and say whether there was one. */
  const drop = () => {
    stopTimer();
    const was = !!waiting;
    waiting = null;
    return was;
  };
  return {
    write(state: () => UrlState, mode: HistoryMode) {
      if (mode === "none" || closed) return;
      // A push is written at once, after the replace still waiting, so the entry it leaves says what it should.
      const s = linked(state());
      if (!s) return;
      if (mode === "push") {
        flush();
        go(search(s), "push");
        return;
      }
      // Each write is the state as it was asked for: a push after it can't slip its own state into the entry it
      // leaves. A debounced one (each move of a resize asks again) waits for the moves to rest, and for its slot.
      waiting = s;
      if (mode === "debounce")
        return schedule(Math.max(PERSIST_MS, replaced + REPLACE_MS - Date.now()));
      // A replace is written in its slot: a later one takes its place without moving the slot.
      const wait = replaced + REPLACE_MS - Date.now();
      if (wait <= 0) flush();
      else if (!timer) schedule(wait);
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
    // The address as `write` puts it: sizes kept on the device ("local") are left out of it.
    measure: (s) => linkText(project(s)[0], keys),
    readWith: (kinds) => void (kindsNow = kinds),
    cancel() {
      closed = true;
      drop();
    },
    // The page is leaving: a replace still waiting (up to 250 ms) is written now, so a reload reopens what was on screen.
    flush() {
      if (!closed) flush();
    },
    keepBroken: (code) => storage.set(`${prefix ?? ""}${BROKEN_KEY}`, code),
    // Back or Forward left the entry a waiting replace was for: it would write that entry's address over this one's.
    onPop: (fn) =>
      location.subscribe(() => {
        drop();
        fn();
      }),
    hold(on) {
      if (!on) return drop();
      stopTimer();
      return !!waiting;
    },
    // "Copy link" copies what is on screen: a replace still waiting is written first.
    href: () => (flush(), location.href()),
  };
}
