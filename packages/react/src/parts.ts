/**
 * The styling contract: the parts of what Jali renders that an app may select on, and the attributes each carries.
 * Everything here is public and changes only with a major version; any other class (`jali-*`, `is-*`) and any
 * attribute not listed is Jali's own and may change in any release. State is always an attribute (`data-*` or ARIA),
 * never a class, so a selector reads `.jali-pane[data-focused]`.
 *
 * The docs' Parts reference is built from this list, and `src/tests/parts.test.tsx` checks that each part and
 * attribute is really rendered.
 */

export interface PartAttribute {
  /** The attribute's name, e.g. `data-focused`. */
  name: string;
  /** What it says. Values in backticks; a flag is present or absent. */
  means: string;
}

export interface Part {
  /** The selector to use. */
  selector: string;
  /** What it is. */
  what: string;
  /** Its state attributes. */
  attributes: readonly PartAttribute[];
}

const unsaved: PartAttribute = {
  name: "data-unsaved",
  means: "Flag: the pane reports unsaved work (`useUnsaved`).",
};
const pinnedTab: PartAttribute = { name: "data-pinned", means: "Flag: a pinned tab." };

/** Every public part, by a stable name. */
export const parts = {
  root: {
    selector: "[data-jali]",
    what: "The workspace's root: the element `<JaliRoot>` renders, with your `className`.",
    attributes: [],
  },
  layer: {
    selector: "[data-jali-layer]",
    what: "Beside the root (`display: contents`), holding everything that overlays the workspace: the palette, Settings, the chooser, the discard question, tab menus and the live region. Tokens set on an element around `<JaliRoot>` reach it; tokens set on the root itself don't.",
    attributes: [],
  },
  workspace: {
    selector: ".jali-workspace",
    what: "The area the panes are laid out in.",
    attributes: [
      { name: "data-single", means: "Flag: Single view (one pane at a time, with the switcher)." },
      {
        name: "data-stacked",
        means: "Flag: stacked view, two panes one above the other (a phone with `phone.stack`).",
      },
      { name: "data-zoomed", means: "Flag: a pane is maximised." },
      {
        name: "data-alone",
        means: "Flag: one pane on screen, shown full-bleed with no tuck, maximise or drag.",
      },
      { name: "data-page", means: "On a curated page: `split` or `single`, the page's mode." },
    ],
  },
  pane: {
    selector: ".jali-pane",
    what: "A pane (a `<section>` region).",
    attributes: [
      { name: "data-pane", means: "The pane's id." },
      { name: "data-kind", means: "The pane's kind." },
      { name: "data-focused", means: "Flag: the focused pane." },
      { name: "data-alone", means: "Flag: the only pane on screen (see the workspace's)." },
      { name: "data-zoomed", means: "Flag: maximised." },
      { name: "data-dragged", means: "Flag: being dragged." },
      { name: "data-drop-target", means: "Flag: the pane a drag would drop on." },
      unsaved,
      {
        name: "data-origin",
        means: "`opened`: opened beside another from a link; `role`: fills a curated page's role.",
      },
      {
        name: "data-boundary",
        means:
          "On an opened pane: how it shows it was opened from another, the person's setting (`tint` or `none`).",
      },
    ],
  },
  paneHeader: {
    selector: ".jali-pane-header",
    what: "A pane's header: title, tabs and buttons.",
    attributes: [],
  },
  paneTitle: {
    selector: ".jali-pane-title",
    what: "The title of a pane on its own (no tabs): icon, name, marks.",
    attributes: [],
  },
  paneActions: {
    selector: ".jali-pane-actions",
    what: "The header's buttons: tuck, maximise, close.",
    attributes: [],
  },
  paneContent: {
    selector: ".jali-pane-content",
    what: "Where the kind's `Component` renders.",
    attributes: [],
  },
  tabBar: { selector: ".jali-tabbar", what: "A tab group's strip.", attributes: [] },
  pinnedTabs: {
    selector: ".jali-tabs-pinned",
    what: "The strip's pinned tabs, which stay in view while the rest scroll.",
    attributes: [],
  },
  tabItem: {
    selector: ".jali-tab-item",
    what: "One tab with its buttons.",
    attributes: [
      pinnedTab,
      unsaved,
      {
        name: "data-drop",
        means: "While a tab is dragged along the strip: `before` or `after`, where it will land.",
      },
      { name: "data-renaming", means: "Flag: the rename field has taken the tab's place." },
    ],
  },
  tab: {
    selector: ".jali-tab",
    what: 'A tab (`role="tab"`).',
    attributes: [
      { name: "data-tab", means: "The pane's id." },
      { name: "aria-selected", means: "`true` on the shown tab." },
      pinnedTab,
      {
        name: "data-folded",
        means: "Flag: the layout folded this pane into tabs; it returns when there's room.",
      },
      { name: "data-tucked", means: "Flag: tucked; shown here until it is put back." },
      unsaved,
    ],
  },
  tabClose: {
    selector: ".jali-tab-close",
    what: "A tab's close button (an unsaved dot until hovered or focused).",
    attributes: [],
  },
  tabPutBack: {
    selector: ".jali-tab-putback",
    what: "A tucked tab's Put back button.",
    attributes: [],
  },
  tabAdd: {
    selector: ".jali-tab-add",
    what: "A tab group's New tab button (with a `launcher`).",
    attributes: [],
  },
  tabMore: {
    selector: ".jali-tab-more",
    what: 'The "+N" button for tabs that don\'t fit.',
    attributes: [],
  },
  tabIndicator: {
    selector: ".jali-tab-indicator",
    what: "The one underline under the shown tab.",
    attributes: [],
  },
  tabMenu: {
    selector: ".jali-tab-menu",
    what: 'A tab\'s menu, and the "+N" menu.',
    attributes: [],
  },
  menuItem: {
    selector: "[data-menu-item]",
    what: "An item in a tab's menu; the value is the item's id (Jali's, or yours from `tabMenu`).",
    attributes: [
      { name: "aria-checked", means: "On a checkbox item: `true` or `false`." },
      { name: "aria-disabled", means: "`true` when unavailable." },
    ],
  },
  divider: {
    selector: "[data-divider]",
    what: 'A divider between panes (`role="separator"`); drag it to resize.',
    attributes: [
      {
        name: "aria-orientation",
        means: "`vertical` between side-by-side panes, `horizontal` between stacked ones.",
      },
    ],
  },
  stackDivider: {
    selector: ".jali-stack-divider",
    what: 'Stacked view\'s divider between the two panes on a phone (`role="separator"`); it settles on a third, a half or two thirds.',
    attributes: [{ name: "data-dragging", means: "Flag: being dragged." }],
  },
  dropZone: {
    selector: "[data-drop-zone]",
    what: "The preview of where a dragged pane will go; the value is `left`, `right`, `top`, `bottom` or `centre`.",
    attributes: [],
  },
  dragChip: {
    selector: ".jali-drag-chip",
    what: "The chip that follows the pointer while a pane is dragged.",
    attributes: [],
  },
  shelf: {
    selector: ".jali-shelf",
    what: "Tucked and folded panes, as chips (`<Shelf />`).",
    attributes: [],
  },
  shelfChip: {
    selector: ".jali-shelf-chip",
    what: "A chip on the shelf.",
    attributes: [
      { name: "data-chip", means: "The pane's id." },
      { name: "data-reason", means: "`tucked` or `folded`." },
      {
        name: "data-activity",
        means:
          "The pane's activity (`useActivity`): `idle`, `working` (loading too), `needs-you` or `failed`.",
      },
      { name: "data-summary", means: 'Flag: the one "N folded" chip that stands for several.' },
      unsaved,
    ],
  },
  switcher: {
    selector: ".jali-switcher",
    what: "Single view's pane switcher (a tab list).",
    attributes: [],
  },
  switcherItem: {
    selector: ".jali-switch-item",
    what: "One pane in the switcher.",
    attributes: [
      { name: "aria-selected", means: "`true` on the pane in view." },
      { name: "data-tucked", means: "Flag: a tucked pane." },
      { name: "data-in-view", means: "Flag: in stacked view, the other pane on screen." },
      unsaved,
    ],
  },
  peek: {
    selector: ".jali-peek",
    what: "The peek sheet: a linked object shown over the panes.",
    attributes: [],
  },
  pageBar: {
    selector: ".jali-page-bar",
    what: "A curated page's bar: its roles, Single view or Split view, Reset.",
    attributes: [],
  },
  pageTab: {
    selector: ".jali-page-tab",
    what: "One role on a curated page's bar.",
    attributes: [
      { name: "data-role", means: "The role's id." },
      {
        name: "data-state",
        means: "`focused`, `shown`, `behind` (open, not in view) or `off` (not open).",
      },
    ],
  },
  followToggle: {
    selector: ".jali-follow-toggle",
    what: "A linked pane's Following and Keep control.",
    attributes: [{ name: "data-follow", means: "`following`, `kept` or `plain`." }],
  },
  paletteItem: {
    selector: ".jali-palette-item",
    what: 'A command in ⌘K, or an entry in the "Add to tabs of…" chooser.',
    attributes: [
      { name: "data-command-id", means: "In ⌘K: the command's id." },
      { name: "aria-selected", means: "`true` on the highlighted entry." },
      { name: "aria-disabled", means: "`true` when unavailable." },
    ],
  },
  dialog: {
    selector: ".jali-scrim",
    what: 'A dialog\'s backdrop, holding the dialog: the palette, Settings, the "Add to tabs of…" chooser and the discard question.',
    attributes: [],
  },
  icon: {
    selector: "[data-jali-icon]",
    what: "One of Jali's own icons; the value is its name (`close`, `pin`…). Your icons carry what you give them.",
    attributes: [],
  },
  hostChrome: {
    selector: "[data-jali-chrome]",
    what: "Yours to set: your own chrome inside the root, which Jali never pulls focus out of.",
    attributes: [],
  },
} satisfies Record<string, Part>;

export type PartName = keyof typeof parts;
