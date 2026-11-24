/**
 * Names a short code block on a docs page may use without declaring them: the app's instance, a few pane kinds and
 * the app's own helpers. tooling/docs-check.mjs typechecks every ```ts and ```tsx block on the site with these in
 * scope, so an excerpt such as `jali.actions.focus("a")` still checks. A block that declares or imports one of these
 * names uses its own.
 */
import type { Jali, LayoutInput, ObjectRef, PaneKindBase } from "jali-layout";
import type { Pane } from "jali-layout/react";

declare global {
  /** The app's instance, from `createJali`. */
  const jali: Jali;
  /** The app's pane kinds, as passed to `createJali({ panes })`. */
  const panes: readonly PaneKindBase[];
  /** The layout the app opens on. */
  const layout: LayoutInput;
  /** A few pane kinds, as the support desk and orders examples define them. */
  const order: Pane<{ id: number }>;
  const customer: Pane<{ id: number }>;
  const ticket: Pane<{ id: number }>;
  const note: Pane<{ id: number }>;
  /** Helpers of the app's own: what a block calls to save, report or show something. */
  function saveDocument(pane: string, data: object): void;
  function saveReportName(ref: ObjectRef, name: string): Promise<void>;
  function exportCsv(ref: ObjectRef): void;
  function share(): void;
  function togglePlayback(): void;
}
