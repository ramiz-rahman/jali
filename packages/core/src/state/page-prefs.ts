import type { StoragePort } from "../ports";
/**
 * What a curated page remembers for one person on this device: the mode they last chose and their split layout
 * (structure and sizes). Never part of a link. Opened panes are investigation, not layout: they are not saved.
 */
import * as core from "../layout/engine";
import type { KindRegistry, Layout } from "../layout/types";
import type { ViewMode } from "../profile";

export interface PagePrefs {
  mode: ViewMode;
  split: Layout | null;
}

// "review:" is the key from before pages were called pages (19 Nov 2026), kept so saved layouts are not lost.
const key = (profile: string) => `review:${profile}`;

export function loadPrefs(
  storage: StoragePort,
  profile: string | undefined,
  kinds: KindRegistry,
): PagePrefs {
  const none: PagePrefs = { mode: "single", split: null };
  if (!profile) return none;
  try {
    const v = JSON.parse(storage.get(key(profile)) ?? "null") as {
      mode?: string;
      split?: string;
      multi?: string;
    } | null;
    if (!v) return none;
    // "multi" and `multi` are the names from before 19 Nov 2026, read so a saved choice and layout are kept.
    const saved = v.split ?? v.multi;
    return {
      mode: v.mode === "split" || v.mode === "multi" ? "split" : "single",
      split: saved ? core.decode(saved, kinds) : null,
    };
  } catch {
    return none;
  }
}

export function savePrefs(storage: StoragePort, profile: string, prefs: PagePrefs): void {
  storage.set(
    key(profile),
    JSON.stringify({ mode: prefs.mode, split: prefs.split ? core.encode(prefs.split) : undefined }),
  );
}
