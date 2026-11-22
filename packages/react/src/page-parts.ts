/**
 * A curated page's contract with the components that render it: the key its parts are kept under, and what they are.
 * Nothing else: `definePage` (define.ts) puts the parts on (chrome/PageBar.tsx), and `<JaliView>`, `<Panes>` and
 * `<SettingsPanel>` read them through this key, so none of them imports another to find the page.
 */
import type { ComponentType } from "react";

/** Where a page from `definePage` keeps its React parts (chrome/PageBar.tsx). */
export const PAGE_PARTS: unique symbol = /* @__PURE__ */ Symbol.for("jali.react.page");

/** What a curated page renders, by part: put on the page by `definePage`, read by `<JaliView>`, `<Panes>` and
 *  `<SettingsPanel>`. */
export interface PageParts {
  View: ComponentType;
  Ghost: ComponentType<{ role: string }>;
  Settings: ComponentType;
}
