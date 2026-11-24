/**
 * What the site remembers in the reader's browser, and storage that never throws: private windows, blocked storage
 * and previews just forget. Every key the site uses is here, so none is spelled twice (the inline script in
 * src/layouts/Document.astro, which runs before the first paint, gets them through `define:vars`).
 */
export const STORAGE_KEYS = {
  /** The reader's theme: "light", "dark" or "system". */
  theme: "jali-docs-theme",
  /** "1" when long code lines wrap. */
  codeWrap: "jali-docs-code-wrap",
  /** What the hero's tree panel shows. */
  treePanel: "jali-docs:tree-panel",
  /** "1" once the hero's tour has played (or been stopped) this session. */
  heroTour: "jali-docs:hero-tour",
} as const;

/** A remembered choice of tab (a choice group's, such as "pm"). */
export const choiceKey = (group: string) => `jali-docs-tab:${group}`;

type Area = "local" | "session";
const area = (where: Area) => (where === "local" ? window.localStorage : window.sessionStorage);

export function readStored(key: string, where: Area = "local"): string | null {
  try {
    return area(where).getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string, where: Area = "local"): void {
  try {
    area(where).setItem(key, value);
  } catch {
    /* nothing to keep it in */
  }
}
