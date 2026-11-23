/**
 * A curated page's English (`definePage`): the words only a page shows or says. They live apart from the rest of
 * `en` so that an app without a page doesn't ship them; a page's engine (actions/page.ts) adds them to the
 * instance's messages, under any translation's. `en` (state/messages.ts) has them too, for translators.
 */
import type { Toast } from "./apply";

const panes = (n: number) => (n === 1 ? "pane" : "panes");

/** What a curated page announces. */
const announcements = {
  pageOpened: (page: string, mode: "single" | "split") =>
    `${page} · ${mode === "single" ? "Single view: one view at a time" : "Split view: views side by side"}`,
  modeSingle: (view: string) => `Single view: showing ${view}. Your split layout is kept.`,
  modeSplit: "Split view: drag tabs into the layout to see views side by side",
  viewing: (view: string) => `Showing ${view}`,
  pageReset: "Layout reset to its design",
  activated: (noun: string, id: string | number, closed: number) =>
    `Showing ${noun} ${id}${closed ? ` · ${closed} opened ${panes(closed)} closed` : ""}`,
  roleHidden: (view: string) => `${view} closed · it's still in the tabs`,
  roleShown: (view: string) => `${view} on screen`,
  lastView: (view: string) => `${view} is the only view on screen`,
  replaced: (view: string, was: string) => `${view} in place of ${was} · ${was} is in the tabs`,
  replacedNeedsRoom: (view: string, was: string) =>
    `${view} in place of ${was} · it needed more room, so the layout adjusted`,
  alreadyView: (view: string) => `${view} is already a view on this page`,
  nothingOpened: "Nothing opened beyond the page",
  backToPage: (page: string, count: number) =>
    `Back to ${page} · ${count} opened ${panes(count)} closed · Undo available`,
};

/** The page's commands, in ⌘K and the keyboard list. */
const commands = {
  /** `page` is the curated page's name; undefined in an instance without one. */
  pageBack: (page: string | undefined) => `Back to ${page ?? "page"} (close opened panes)`,
  pageReset: "Reset layout to its design",
  pageSingle: "Single view: one view at a time",
  pageSplit: "Split view: views side by side",
  pageOpen: (page: string | undefined) => `Open ${page ?? "page"}`,
  /** `app` is the app's name for the free layout (`createJali({ name })`), when it gave one; `page` is the page's. */
  pageLeave: (app: string | undefined, page: string | undefined) =>
    app ? `Open ${app}` : `Leave ${page ?? "the page"}`,
};

/** The page's toast. */
const toasts = {
  backToPage: (page: string, count: number): Toast => ({
    title: `Back to ${page}`,
    description: `${count} opened ${panes(count)} closed`,
    undo: true,
  }),
};

/** A curated page: its bar, its tabs and the ⌥ preview. */
const page = {
  viewMode: "View mode",
  single: "Single view",
  singleTip: "One view at a time",
  split: "Split view",
  splitTip: "Views side by side: drag tabs into the layout",
  /** The page bar's group for the panes opened from links, and its count: "**2** opened panes". */
  openedLabel: "Opened panes",
  openedCount: <T>(count: number, bold: (text: string) => T): (string | T)[] => [
    bold(String(count)),
    ` opened ${panes(count)}`,
  ],
  backTo: (page: string) => `Back to ${page}`,
  reset: "Reset layout to its design",
  resetTip: "Reset layout · drops your split layout",
  tabsLabel: (page: string) => `${page} views`,
  tabOff: "Not on screen",
  tabBehind: "Behind another tab",
  tabOn: "On screen",
  /** `altClick` is the platform's words for it ("⌥-click"); undefined where the view can't be placed beside (the app's
   *  `allow` turns `open` off there), so the tip offers only what a click does. */
  tabTipOff: (view: string, altClick?: string) =>
    altClick
      ? `${view} in place of the view you're in · drag to place it · ${altClick}: beside`
      : `${view} in place of the view you're in`,
  tabTipFocus: (view: string) => `Focus ${view} · drag to move it`,
  tabTipSingle: (view: string, altClick?: string) =>
    altClick ? `${view} · drag or ${altClick} to see it beside` : view,
  /** The ⌥ preview: where a view opens, and the views it sends back to the tabs. */
  ghost: (view: string, leaving: string[]) =>
    `${view} opens here${leaving.length ? ` · ${leaving.join(", ")} back to the tabs` : ""}`,
};

/** A curated page's English, by area: every key here is also in `en`. */
export const pageEn = { announcements, commands, toasts, page };
