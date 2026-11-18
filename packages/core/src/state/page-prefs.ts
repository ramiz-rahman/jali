import type { StoragePort } from "../ports";
/**
 * What a curated page remembers for one person on this device: the mode they last chose and their multiplexed layout
 * (structure and sizes). Never part of a link. Opened panes are investigation, not layout: they are not saved.
 */
import * as core from "../layout";
import type { KindRegistry, Layout } from "../layout/types";
import type { ViewMode } from "../profile";

export interface PagePrefs { mode: ViewMode; multi: Layout | null }

// "review:" is the key from before pages were called pages (19 Nov 2026), kept so saved layouts are not lost.
const key = (profile: string) => `review:${profile}`;

export function loadPrefs(storage: StoragePort, profile: string | undefined, kinds: KindRegistry): PagePrefs {
  const none: PagePrefs = { mode: "single", multi: null };
  if (!profile) return none;
  try {
    const v = JSON.parse(storage.get(key(profile)) ?? "null") as { mode?: string; multi?: string } | null;
    if (!v) return none;
    return { mode: v.mode === "multi" ? "multi" : "single", multi: v.multi ? core.decode(v.multi, kinds) : null };
  } catch {
    return none;
  }
}

export function savePrefs(storage: StoragePort, profile: string, prefs: PagePrefs): void {
  storage.set(key(profile), JSON.stringify({ mode: prefs.mode, multi: prefs.multi ? core.encode(prefs.multi) : undefined }));
}
