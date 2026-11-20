/**
 * The styling contract: the parts of what Jali renders that an app may select on, the element each is, and the
 * attributes that carry its state. Everything here is public and changes only with a major version, and so are the
 * `--jali-*` tokens and the header's container name (`jali-header`). Any other class (`jali-*`, `is-*`), any element
 * inside a part that is not itself a part, and any attribute not listed is Jali's own and may change in any release.
 * State is always an attribute (`data-*` or ARIA), never a class, so a selector reads `.jali-pane[data-focused]`.
 *
 * The docs' Parts reference is built from this list, and `tests/parts.test.tsx` checks that each part and
 * attribute is really rendered.
 */

export interface PartAttribute {
  /** The attribute's name, e.g. `data-focused`. */
  name: string;
  /** What it says. Values in backticks; a flag is present or absent. */
  means: string;
}

/** Where a part is, for the reference's sections. */
export type PartArea =
  | "Workspace"
  | "Pane"
  | "Tabs"
  | "Dividers"
  | "Drag and drop"
  | "Shelf"
  | "Linked panes"
  | "Dialogs and menus"
  | "Small screens"
  | "Curated pages"
  | "Icons and your chrome";

export interface Part {
  /** The selector to use. */
  selector: string;
  /** The element it is (`button`, `div`…), so a rule knows what it styles. */
  element: string;
  /** The reference's section. */
  area: PartArea;
  /** What it is. */
  what: string;
  /** Its state attributes. */
  attributes: readonly PartAttribute[];
  /** Its `::before` and `::after` are the app's, for a lamp, a badge or a stripe: Jali's styles never use them (a
   *  test reads the stylesheets), and Jali puts no content of its own there. */
  adornments?: true;
}

/** What the reference says of a part with `adornments`. */
export const ADORNMENTS =
  "Its `::before` and `::after` are yours: Jali's styles never use them, so a lamp, a badge or a stripe drawn there stays.";

const unsaved: PartAttribute = {
  name: "data-unsaved",
  means: "Flag: the pane reports unsaved work (`useUnsaved`).",
};
const pinnedTab: PartAttribute = { name: "data-pinned", means: "Flag: a pinned tab." };
/** On every control Jali renders (pressed.ts keeps the list). */
const pressed: PartAttribute = {
  name: "data-pressed",
  means:
    "Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it.",
};

/** Every public part, by a stable name. */
export const parts = {
  root: {
    selector: "[data-jali]",
    element: "div",
    area: "Workspace",
    what: "The workspace's root: the element `<JaliRoot>` renders, with your `className`.",
    attributes: [],
  },
  layer: {
    selector: "[data-jali-layer]",
    element: "div",
    area: "Workspace",
    what: "Beside the root (`display: contents`), holding everything that overlays the workspace: the palette, Settings, the chooser, the discard question, tab menus and the live region. Tokens set on an element around `<JaliRoot>` reach it; tokens set on the root itself don't.",
    attributes: [],
  },
  workspace: {
    selector: ".jali-workspace",
    element: 'section (`main` with `createJali({ landmark: "main" })`)',
    area: "Workspace",
    what: "The area the panes are laid out in.",
    attributes: [
      { name: "data-single", means: "Flag: Single view (one pane at a time, with the switcher)." },
      {
        name: "data-stacked",
        means:
          "Flag: stacked view, two panes one above the other (a phone with `phone.stack`), or a pane each side of a fold.",
      },
      {
        name: "data-fold",
        means: "Across a fold: `row` (the halves side by side) or `column` (one above the other).",
      },
      { name: "data-zoomed", means: "Flag: a pane is maximised." },
      { name: "data-full-screen", means: "Flag: a pane is on the whole screen." },
      {
        name: "data-alone",
        means: "Flag: one pane on screen, shown full-bleed with no tuck, maximise or drag.",
      },
      { name: "data-page", means: "On a curated page: `split` or `single`, the page's mode." },
    ],
  },
  pane: {
    selector: ".jali-pane",
    element: "section",
    area: "Pane",
    what: "A pane (a `<section>` region).",
    attributes: [
      { name: "data-pane", means: "The pane's id." },
      { name: "data-kind", means: "The pane's kind." },
      { name: "data-focused", means: "Flag: the focused pane." },
      { name: "data-full-screen", means: "Flag: on the whole screen (`toggleFullScreen`)." },
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
    element: "div",
    area: "Pane",
    what: "A pane's header, in this order: the grip, the title (or tabs) with Following / Kept, the pane's own controls (`paneTools`), then Jali's buttons (`paneActions`). It is a size container named `jali-header`, public, so a narrow header can be styled with `@container jali-header (max-width: 20rem) { … }`. A header too narrow for its title gives way before the title gets shorter than a few characters, and says so with `data-narrow`.",
    attributes: [
      {
        name: "data-narrow",
        means:
          "`actions`: tuck, maximise, full screen and pop out moved into the pane's menu (⋯), where they keep their names; `tools`: the pane's own controls are hidden too, and the menu lists the pane's commands. Absent at normal widths.",
      },
    ],
  },
  paneTitle: {
    selector: ".jali-pane-title",
    element: "div",
    area: "Pane",
    what: "The title of a pane on its own (no tabs): icon, name, marks.",
    attributes: [],
  },
  paneActions: {
    selector: ".jali-pane-actions",
    element: "div",
    area: "Pane",
    what: "The header's buttons (`buttons`: by default tuck, maximise, close), and ⋯ for the rest of the pane's menu.",
    attributes: [
      {
        name: "data-count",
        means:
          "How many buttons it shows, ⋯ included, so a theme that draws them as one strip can size it: which buttons show changes from pane to pane.",
      },
    ],
  },
  paneTools: {
    selector: ".jali-pane-tools",
    element: "div",
    area: "Pane",
    what: "The pane's own controls in its header (`useHeaderActions`), after the title and before Jali's buttons. Rendered only while the content gives some; a narrow header drops it before its title gets short (`data-narrow=\"tools\"`).",
    attributes: [],
  },
  paneAction: {
    selector: ".jali-pane-action",
    element: "button",
    area: "Pane",
    what: "One of the header's buttons, and ⋯ for the pane's menu. Only the buttons the pane allows are rendered, so their number changes from pane to pane.",
    attributes: [
      {
        name: "data-action",
        means:
          "`tuck`, `zoom` (Maximise, or Restore while maximised: see the pane's `data-zoomed`), `fullscreen`, `popout`, `close` or `menu` (⋯).",
      },
      { name: "aria-pressed", means: "On `fullscreen` and `popout`: `true` while on." },
      { name: "disabled", means: "On `tuck`: nothing to tuck behind (its tooltip says why)." },
      pressed,
    ],
  },
  activity: {
    selector: ".jali-activity",
    element: "span",
    area: "Pane",
    what: "A pane's activity dot (`useActivity`), after its name in a header, a tab, the pane switcher and tab menus. Absent while idle. Jali draws it with the element's size, corners and background, so restyle it to draw your own mark.",
    attributes: [
      {
        name: "data-activity",
        means: "`loading`, `working`, `live`, `needs-you` or `error`.",
      },
    ],
    adornments: true,
  },
  paneContent: {
    selector: ".jali-pane-content",
    element: "div",
    area: "Pane",
    what: "Where the kind's `Component` renders.",
    attributes: [],
  },
  tabBar: {
    selector: ".jali-tabbar",
    element: "div",
    area: "Tabs",
    what: "A tab group's strip.",
    attributes: [],
  },
  pinnedTabs: {
    selector: ".jali-tabs-pinned",
    element: "div",
    area: "Tabs",
    what: "The strip's pinned tabs, which stay in view while the rest scroll.",
    attributes: [],
  },
  tabItem: {
    selector: ".jali-tab-item",
    element: "div",
    area: "Tabs",
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
    element: "div",
    area: "Tabs",
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
      pressed,
    ],
    adornments: true,
  },
  tabTitle: {
    selector: ".jali-tab-title",
    element: "span",
    area: "Tabs",
    what: "A tab's name, inside `.jali-tab`. Give it `min-width: 0` to let it shrink first when you add to the tab.",
    attributes: [],
  },
  tabClose: {
    selector: ".jali-tab-close",
    element: "button",
    area: "Tabs",
    what: "A tab's close button (an unsaved dot until hovered or focused).",
    attributes: [pressed],
  },
  rename: {
    selector: ".jali-rename",
    element: "input",
    area: "Tabs",
    what: "The rename field that takes a tab's (or a lone pane's title's) place while renaming (`createJali({ rename })`).",
    attributes: [],
  },
  tabPutBack: {
    selector: ".jali-tab-putback",
    element: "button",
    area: "Tabs",
    what: "A tucked tab's Put back button.",
    attributes: [pressed],
  },
  tabAdd: {
    selector: ".jali-tab-add",
    element: "button",
    area: "Tabs",
    what: "A tab group's New tab button (with a `launcher`).",
    attributes: [pressed],
  },
  tabMore: {
    selector: ".jali-tab-more",
    element: "button",
    area: "Tabs",
    what: 'The "+N" button for tabs that don\'t fit.',
    attributes: [pressed],
  },
  tabIndicator: {
    selector: ".jali-tab-indicator",
    element: "span",
    area: "Tabs",
    what: "The one underline under the shown tab.",
    attributes: [],
  },
  tabMenu: {
    selector: ".jali-tab-menu",
    element: "div",
    area: "Dialogs and menus",
    what: 'A tab\'s menu, and the "+N" menu.',
    attributes: [],
  },
  menuItem: {
    selector: "[data-menu-item]",
    element: "button",
    area: "Dialogs and menus",
    what: "An item in a tab's menu; the value is the item's id (Jali's, or yours from `tabMenu`).",
    attributes: [
      { name: "aria-checked", means: "On a checkbox item: `true` or `false`." },
      { name: "aria-disabled", means: "`true` when unavailable." },
      pressed,
    ],
  },
  divider: {
    selector: "[data-divider]",
    element: "div",
    area: "Dividers",
    what: 'A divider between panes (`role="separator"`); drag it to resize.',
    attributes: [
      {
        name: "aria-orientation",
        means: "`vertical` between side-by-side panes, `horizontal` between stacked ones.",
      },
    ],
  },
  dividerLine: {
    selector: ".jali-divider-line",
    element: "span",
    area: "Dividers",
    what: "The line inside a divider, drawn while it is pointed at or dragged (in `--jali-border-strong`). Transparent at rest.",
    attributes: [],
  },
  foldLine: {
    selector: ".jali-fold-line",
    element: "div",
    area: "Small screens",
    what: "The hairline drawn on a fold's hinge, between the two halves.",
    attributes: [],
  },
  stackDivider: {
    selector: ".jali-stack-divider",
    element: "div",
    area: "Small screens",
    what: 'Stacked view\'s divider between the two panes on a phone (`role="separator"`); it settles on a third, a half or two thirds.',
    attributes: [{ name: "data-dragging", means: "Flag: being dragged." }],
  },
  dropZone: {
    selector: "[data-drop-zone]",
    element: "div",
    area: "Drag and drop",
    what: "The preview of where a dragged pane will go; the value is `left`, `right`, `top`, `bottom` or `centre`.",
    attributes: [],
  },
  dragChip: {
    selector: ".jali-drag-chip",
    element: "div",
    area: "Drag and drop",
    what: "The chip that follows the pointer while a pane is dragged.",
    attributes: [],
  },
  tabFolded: {
    selector: ".jali-tab-folded",
    element: "button",
    area: "Tabs",
    what: 'The "N folded" chip at the end of a tab strip: the panes the layout folded into this place, but the one it shows. Its menu lists them, each with its activity dot.',
    attributes: [
      {
        name: "data-activity",
        means:
          "The most pressing activity of the panes behind it (`useActivity`): most pressing first, `failed`, `needs-you`, `working` (loading too), then `live`; absent when all are idle. The chip shows the shelf's shape for it (`activityShape`).",
      },
      pressed,
    ],
  },
  shelf: {
    selector: ".jali-shelf",
    element: "div",
    area: "Shelf",
    what: "The panes you tucked, as chips (`<Shelf />`). Folded panes wait behind their strip's `tabFolded` chip.",
    attributes: [],
  },
  shelfChip: {
    selector: ".jali-shelf-chip",
    element: "div",
    area: "Shelf",
    what: "A chip on the shelf.",
    attributes: [
      { name: "data-chip", means: "The pane's id." },
      { name: "data-reason", means: "`tucked`." },
      {
        name: "data-activity",
        means:
          "The pane's activity (`useActivity`): `idle`, `working` (loading too), `live`, `needs-you` or `failed`.",
      },
      unsaved,
    ],
  },
  activityShape: {
    selector: ".jali-activity-shape",
    element: "span",
    area: "Shelf",
    what: 'A pane\'s activity as a shape as well as a colour, never colour alone: in a shelf chip, the shelf\'s menu and the "N folded" chip. Absent while idle. Jali draws the ring with a border and a spin, the live dot with a border and a background that breathe, "!" as text and the cross with the `activityError` icon (both in `currentColor`). To draw your own, clear Jali\'s (`border: 0; animation: none; background: none; color: transparent`) and draw in `::before`.',
    attributes: [
      {
        name: "data-activity",
        means:
          '`working` (loading too), `live`, `needs-you` or `failed`, as on the shelf chip and the "N folded" chip.',
      },
      {
        name: "data-shape",
        means: 'Jali\'s shape for it: `ring`, `dot` (live), `need` ("!") or `fail` (a cross).',
      },
    ],
    adornments: true,
  },
  shelfChipMain: {
    selector: ".jali-shelf-chip-main",
    element: "button",
    area: "Shelf",
    what: "The chip's main button: the pane's icon, name and marks. Brings the pane back.",
    attributes: [pressed],
  },
  shelfChipTitle: {
    selector: ".jali-shelf-chip-title",
    element: "span",
    area: "Shelf",
    what: "A pane's name, in a chip and in the shelf's menu.",
    attributes: [],
  },
  shelfChipPut: {
    selector: ".jali-shelf-chip-put",
    element: "button",
    area: "Shelf",
    what: "A tucked chip's Put back button, shown while the chip is hovered or has focus.",
    attributes: [pressed],
  },
  shelfMore: {
    selector: ".jali-shelf-more",
    element: "button",
    area: "Shelf",
    what: "The \"+N\" button for chips that don't fit; it opens the shelf's menu.",
    attributes: [{ name: "aria-expanded", means: "`true` while its menu is open." }, pressed],
  },
  shelfMenu: {
    selector: ".jali-shelf-menu",
    element: 'div (`role="menu"`)',
    area: "Shelf",
    what: "The shelf's menu of the chips that don't fit.",
    attributes: [],
  },
  shelfMenuItem: {
    selector: ".jali-shelf-menu-item",
    element: 'button (`role="menuitem"`)',
    area: "Shelf",
    what: "One pane in the shelf's menu.",
    attributes: [pressed],
  },
  switcher: {
    selector: ".jali-switcher",
    element: "nav",
    area: "Small screens",
    what: "Single view's pane switcher (a tab list).",
    attributes: [],
  },
  switcherItem: {
    selector: ".jali-switch-item",
    element: "button",
    area: "Small screens",
    what: "One pane in the switcher.",
    attributes: [
      { name: "aria-selected", means: "`true` on the pane in view." },
      { name: "data-tucked", means: "Flag: a tucked pane." },
      { name: "data-in-view", means: "Flag: in stacked view, the other pane on screen." },
      unsaved,
      pressed,
    ],
    adornments: true,
  },
  peek: {
    selector: ".jali-peek",
    element: "aside",
    area: "Linked panes",
    what: "The peek sheet: a linked object shown over the panes.",
    attributes: [],
  },
  pageBar: {
    selector: ".jali-page-bar",
    element: "div",
    area: "Curated pages",
    what: "A curated page's bar: its roles, Single view or Split view, Reset.",
    attributes: [],
  },
  pageTab: {
    selector: ".jali-page-tab",
    element: "button",
    area: "Curated pages",
    what: "One role on a curated page's bar.",
    attributes: [
      { name: "data-role", means: "The role's id." },
      {
        name: "data-state",
        means: "`focused`, `shown`, `behind` (open, not in view) or `off` (not open).",
      },
      pressed,
    ],
  },
  followToggle: {
    selector: ".jali-follow-toggle",
    element: "button",
    area: "Linked panes",
    what: "A linked pane's one Following / Kept toggle (a button, not a container): a click switches. Its word is `followLabel`.",
    attributes: [{ name: "data-follow", means: "`following`, `kept` or `plain`." }, pressed],
  },
  followLabel: {
    selector: ".jali-follow-label",
    element: "span",
    area: "Linked panes",
    what: 'The toggle\'s printed word, "Following" or "Kept" (its icon stays when a narrow header hides the word).',
    attributes: [],
  },
  keptBadge: {
    selector: ".jali-kept-badge",
    element: "span",
    area: "Linked panes",
    what: '"Kept" on a kept pane that is no longer linked to a list, in place of the toggle.',
    attributes: [],
  },
  paletteItem: {
    selector: ".jali-palette-item",
    element: "li",
    area: "Dialogs and menus",
    what: 'A command in ⌘K, or an entry in the "Add to tabs of…" chooser.',
    attributes: [
      { name: "data-command-id", means: "In ⌘K: the command's id." },
      { name: "aria-selected", means: "`true` on the highlighted entry." },
      { name: "aria-disabled", means: "`true` when unavailable." },
    ],
  },
  dialog: {
    selector: ".jali-scrim",
    element: "div",
    area: "Dialogs and menus",
    what: 'A dialog\'s backdrop, holding the dialog (`dialogBox`): the palette, Settings, the "Add to tabs of…" chooser and the discard question.',
    attributes: [],
  },
  dialogBox: {
    selector: ".jali-dialog",
    element: 'div (`role="dialog"`, or `"alertdialog"` for the discard question)',
    area: "Dialogs and menus",
    what: "The dialog itself, inside its scrim.",
    attributes: [
      {
        name: "data-dialog",
        means:
          '`palette` (⌘K), `chooser` ("Add to tabs of…" and `actions.choose`), `settings` or `confirm` (the discard question).',
      },
    ],
  },
  dialogButton: {
    selector: ".jali-dialog-button",
    element: "button",
    area: "Dialogs and menus",
    what: "A button in a dialog's footer (the discard question's Discard and Keep editing).",
    attributes: [
      {
        name: "data-role",
        means: "`primary` (the safe choice, focused when it opens) or `secondary`.",
      },
      pressed,
    ],
  },
  palette: {
    selector: ".jali-palette",
    element: "div",
    area: "Dialogs and menus",
    what: "The ⌘K and chooser dialog (also `.jali-dialog`): its field, then its list.",
    attributes: [],
  },
  paletteInput: {
    selector: ".jali-palette-input",
    element: 'input (`role="combobox"`)',
    area: "Dialogs and menus",
    what: "The palette's and the chooser's search field.",
    attributes: [],
  },
  paletteName: {
    selector: ".jali-palette-name",
    element: "span",
    area: "Dialogs and menus",
    what: "A row's name: the command's title, or the entry's label.",
    attributes: [],
  },
  paletteGroup: {
    selector: ".jali-palette-group",
    element: "span",
    area: "Dialogs and menus",
    what: 'In ⌘K: the command\'s group label ("Focus", "Layout", or yours).',
    attributes: [],
  },
  paletteHint: {
    selector: ".jali-palette-hint",
    element: "span",
    area: "Dialogs and menus",
    what: "In the chooser: the entry's hint, after its name.",
    attributes: [],
  },
  paletteKeys: {
    selector: ".jali-palette-keys",
    element: "kbd",
    area: "Dialogs and menus",
    what: "In ⌘K: the command's keys, when it has any.",
    attributes: [],
  },
  icon: {
    selector: "[data-jali-icon]",
    element: "svg",
    area: "Icons and your chrome",
    what: "One of Jali's own icons; the value is its name (`close`, `pin`…). Your icons carry what you give them.",
    attributes: [],
  },
  iconButton: {
    selector: ".jali-icon-btn",
    element: "button",
    area: "Icons and your chrome",
    what: "A button that is only an icon: each of a pane header's buttons (also `paneAction`), Reset on a curated page's bar, and the close buttons of the peek sheet and Settings. `<IconButton>` renders one for your own chrome, so your buttons match Jali's in every theme.",
    attributes: [
      { name: "aria-pressed", means: "On a toggle: `true` while on." },
      { name: "disabled", means: "Flag: it can't be used now." },
      pressed,
    ],
  },
  hostChrome: {
    selector: "[data-jali-chrome]",
    element: "any",
    area: "Icons and your chrome",
    what: "Yours to set: your own chrome inside the root, which Jali never pulls focus out of.",
    attributes: [],
  },
} satisfies Record<string, Part>;

export type PartName = keyof typeof parts;
