/**
 * URL sync. Structure goes in ?l= (layout-core codec); zoom and peek ride along. Deliberate structural changes
 * push a history entry; resizes replace it 120ms after the last move; view changes replace immediately.
 */
import type { Layout, ObjectRef, ViewState } from "../layout-core/types";
import { core } from "./core";
import { allPanes, fit, getState, hooks, setState } from "./store";
import { DEFAULT_PRESET, presetById } from "./presets";

export const PERSIST_MS = 120;

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

function buildUrl(): string {
  const s = getState();
  const q = new URLSearchParams(location.search);
  q.set("l", core.encode(s.layout));
  if (s.view.zoomed) q.set("zoom", s.view.zoomed); else q.delete("zoom");
  if (s.view.peek) q.set("peek", encodePeek(s.view.peek)); else q.delete("peek");
  return `${location.pathname}?${q.toString()}${location.hash}`;
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function writeUrl(mode: "push" | "replace" | "debounce" | "none") {
  if (mode === "none") return;
  clearTimeout(timer);
  const write = (push: boolean) => {
    const url = buildUrl();
    if (url === location.pathname + location.search + location.hash) return;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    setState({ savedAt: Date.now() });
  };
  if (mode === "debounce") timer = setTimeout(() => write(false), PERSIST_MS);
  else write(mode === "push");
}

export interface UrlRead {
  layout: Layout;
  view: Partial<ViewState>;
  broken?: string;
}

export function readUrl(): UrlRead | null {
  const q = new URLSearchParams(location.search);
  const code = q.get("l");
  const view: Partial<ViewState> = {};
  const peek = q.get("peek");
  if (peek) {
    const r = decodePeek(peek);
    if (r) view.peek = r;
  }
  if (!code) return null;
  const layout = core.decode(code, fit().kinds);
  if (!layout) return { layout: presetById(getState().presetId ?? DEFAULT_PRESET).build(), view: {}, broken: code };
  const zoom = q.get("zoom");
  if (zoom && allPanes(layout.root).some((p) => p.id === zoom)) view.zoomed = zoom;
  return { layout, view };
}

/** Apply the URL to state (initial load and Back/Forward). Returns the broken code, if any. */
export function applyUrl(): string | undefined {
  const r = readUrl();
  if (!r) return;
  const ids = new Set(allPanes(r.layout.root).map((p) => p.id));
  const prev = getState().view;
  const hist = prev.focusHistory.filter((id) => ids.has(id));
  const focused = prev.focused && ids.has(prev.focused) ? prev.focused : hist[0] ?? allPanes(r.layout.root)[0]?.id;
  const view: ViewState = { focusHistory: hist, ...r.view };
  if (focused) view.focused = focused;
  setState({ layout: r.layout, view });
  if (r.broken) {
    try { localStorage.setItem("pane-lab:broken-layout", r.broken); } catch { /* ignore */ }
    history.replaceState(null, "", buildUrl());
  }
  return r.broken;
}

export function installUrlSync(onBroken: (code: string) => void) {
  hooks.writeUrl = writeUrl;
  const onPop = () => {
    const broken = applyUrl();
    if (broken) onBroken(broken);
    hooks.announce("Layout changed by browser history");
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}
