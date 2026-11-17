/**
 * What a curated page remembers for one person on this device: the mode they last chose and their multiplexed layout
 * (structure and sizes). Never part of a link. Opened panes are investigation, not layout: they are not saved.
 */
import * as core from "../../layout-core";
import type { KindRegistry, Layout } from "../../layout-core/types";
import type { ViewMode } from "../profile";

export interface ReviewPrefs { mode: ViewMode; multi: Layout | null }

const key = (profile: string) => `pane-lab:review:${profile}`;

export function loadPrefs(profile: string | undefined, kinds: KindRegistry): ReviewPrefs {
  const none: ReviewPrefs = { mode: "single", multi: null };
  if (!profile) return none;
  try {
    const v = JSON.parse(localStorage.getItem(key(profile)) ?? "null") as { mode?: string; multi?: string } | null;
    if (!v) return none;
    return { mode: v.mode === "multi" ? "multi" : "single", multi: v.multi ? core.decode(v.multi, kinds) : null };
  } catch {
    return none;
  }
}

export function savePrefs(profile: string, prefs: ReviewPrefs): void {
  try {
    localStorage.setItem(key(profile), JSON.stringify({ mode: prefs.mode, multi: prefs.multi ? core.encode(prefs.multi) : undefined }));
  } catch { /* private mode: nothing saved */ }
}
