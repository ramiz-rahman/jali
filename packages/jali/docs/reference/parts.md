# Parts

Every part of Jali you can style, its element, its selector, and the attributes that carry its state.

These are the parts of what Jali renders that your styles may rely on. Each has one selector, a `jali-` class or a `data-` attribute, is one kind of element, and carries its state in attributes, never in classes: select `.jali-pane[data-focused]`, `.jali-tab[aria-selected="true"]` or `.jali-pane-action[data-action="close"]`.

## What is stable

Only what this page lists, and the `--jali-*` tokens in [Tokens](tokens.md), are public. They change only in a major version. Everything else is Jali's own and may change in any release:

- any other `jali-*` class, and any `is-*` class;
- any attribute a part doesn't list here;
- the elements inside a part that are not parts themselves. `.jali-pane-actions button`, `.jali-scrim [role="combobox"]` or `.jali-palette-item kbd` depend on markup that can change. Use `.jali-pane-action`, `.jali-palette-input` and `.jali-palette-keys` instead.

One more name is public: the pane header is a size container named `jali-header`. A narrow header can be styled by its own width, whatever the pane's:

```css
@layer components {
  @container jali-header (max-width: 20rem) {
    .jali-follow-label {
      display: none;
    }
  }
}
```

A narrow header also gives way on its own, before its title (or the shown tab's) gets shorter than a few characters: first tuck, maximise, full screen and pop out move into the pane's menu (⋯), where they keep their names and keys; then the pane's own controls (`useHeaderActions`) are hidden and the menu lists the pane's commands in their place. Close and ⋯ stay. Jali measures the title rather than a width, and takes the buttons back once there is room for both. `data-narrow` on `.jali-pane-header` says how far (`actions`, then `tools`), and is absent at normal widths. The number of buttons a header shows changes from pane to pane, so `.jali-pane-actions` carries `data-count`, ⋯ included, for a theme that draws them as one strip.

Put your rules in a cascade layer after `jali`, as in [Theming](../guides/theming.md#the-layer-line), so they win without `!important`.

```css
@layer components {
  .jali-pane[data-kind="ticket"][data-focused] {
    box-shadow: 0 0 0 2px var(--jali-accent);
  }
  .jali-pane-action[data-action="close"]:hover {
    color: var(--jali-failed);
  }
  .jali-dialog-button[data-role="primary"] {
    font-weight: 600;
  }
  .jali-shelf-chip[data-activity="needs-you"] {
    outline: 1px solid var(--jali-blocked);
  }
}
```

With Tailwind, the same attributes work as variants: `data-[focused]:ring-2`, or `group-data-[zoomed]:hidden` inside a pane.

## Adornments

A tab, a pane switcher item and the activity marks (`.jali-activity`, `.jali-activity-shape`) take no children of yours, so their `::before` and `::after` are yours instead, for a lamp, a badge or a stripe. Jali's styles never use them on these parts, and a test reads Jali's stylesheets to keep it so. Each one says so below.

```css
@layer components {
  .jali-tab[data-recording]::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--jali-failed);
  }
}
```

Give the tab's title `min-width: 0` (`.jali-tab-title`) so it shrinks first when you add to the tab.

## Theme

A started instance writes the theme in use, `light` or `dark`, as `data-theme` on `<html>`, and on its root (`[data-jali]`) and the layer that holds its dialogs (`[data-jali-layer]`) as well, so a rule can be scoped to the instance: `[data-jali][data-theme="dark"] .grain { background-image: url(grain-dark.svg); }`. It follows the theme setting and, for System, the system's preference. The copy on the root and layer is not a theme scope of its own for Jali's styles: whatever sits between `<html>` and the instance still decides its colours. With `createJali({ pageTheme: false })` Jali writes none of them, because the page's own theme decides: switch images on your own theme scope, or on `prefers-color-scheme` when the page has none. Nor does it write over a `data-theme` you give `<JaliRoot>`.

## Pressed

Every control Jali renders carries `data-pressed` while it is held down: by the pointer, or by Space or Enter while it has focus. `:active` covers only the pointer, so a theme that shows a key going down reads `[data-pressed]` to show it from the keyboard as well. One mechanism sets it for all of them: the header's buttons, tabs and their buttons, the "+N" and "N folded" chips, shelf chips and their menu, the Following / Kept toggle, the pane switcher, a curated page's tabs, tab menu items and dialog buttons. Each lists it below. Jali's own styles don't read it.

```css
@layer components {
  .jali-pane-action[data-pressed],
  .jali-tab[data-pressed] {
    translate: 0 1px;
  }
}
```

Attributes a pane sets with `usePaneAttributes` appear on everything that stands for it (its section, tab, shelf chip and switcher entry), alongside these.

Corners, spacing and colours are tokens, not parts: every corner reads `--jali-radius`, `--jali-radius-control`, `--jali-radius-menu` or `--jali-radius-chip`, and the space between panes is `createJali({ gap, inset })`, which Jali writes as `--jali-gap` and `--jali-inset`.

## Instance

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |

## Pane

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-pane` | `section` | A pane (a `<section>` region). | `data-pane`: The pane's id.<br>`data-kind`: The pane's kind.<br>`data-focused`: Flag: the focused pane.<br>`data-full-screen`: Flag: on the whole screen (`toggleFullScreen`).<br>`data-alone`: Flag: the only pane on screen (see the workspace's).<br>`data-zoomed`: Flag: maximised.<br>`data-dragged`: Flag: being dragged.<br>`data-drop-target`: Flag: the pane a drag would drop on.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`).<br>`data-origin`: `opened`: opened beside another from a link; `role`: fills a curated page's role.<br>`data-boundary`: On an opened pane: how it shows it was opened from another, the person's setting (`tint` or `none`). |
| `.jali-pane-header` | `div` | A pane's header, in this order: the grip, the title (or tabs) with Following / Kept, the pane's own controls (`paneTools`), then Jali's buttons (`paneActions`). It is a size container named `jali-header`, public, so a narrow header can be styled with `@container jali-header (max-width: 20rem) { … }`. A header too narrow for its title gives way before the title gets shorter than a few characters, and says so with `data-narrow`. | `data-narrow`: `actions`: tuck, maximise, full screen and pop out moved into the pane's menu (⋯), where they keep their names; `tools`: the pane's own controls are hidden too, and the menu lists the pane's commands. Absent at normal widths. |
| `.jali-pane-title` | `div` | The title of a pane on its own (no tabs): icon, name, marks. | none |
| `.jali-pane-actions` | `div` | The header's buttons (`buttons`: by default tuck, maximise, close), and ⋯ for the rest of the pane's menu. | `data-count`: How many buttons it shows, ⋯ included, so a theme that draws them as one strip can size it: which buttons show changes from pane to pane. |
| `.jali-pane-tools` | `div` | The pane's own controls in its header (`useHeaderActions`), after the title and before Jali's buttons. Rendered only while the content gives some; a narrow header drops it before its title gets short (`data-narrow="tools"`). | none |
| `.jali-pane-action` | `button` | One of the header's buttons, and ⋯ for the pane's menu. Only the buttons the pane allows are rendered, so their number changes from pane to pane. | `data-action`: `tuck`, `zoom` (Maximise, or Restore while maximised: see the pane's `data-zoomed`), `fullscreen`, `popout`, `close` or `menu` (⋯).<br>`aria-pressed`: On `fullscreen` and `popout`: `true` while on.<br>`disabled`: On `tuck`: nothing to tuck behind (its tooltip says why).<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-activity` | `span` | A pane's activity dot (`useActivity`), after its name in a header, a tab, the pane switcher and tab menus. Absent while idle. Jali draws it with the element's size, corners and background, so restyle it to draw your own mark. Its `::before` and `::after` are yours: Jali's styles never use them, so a lamp, a badge or a stripe drawn there stays. | `data-activity`: `loading`, `working`, `live`, `needs-you` or `error`. |
| `.jali-pane-content` | `div` | Where the kind's `Component` renders. | none |

## Tabs

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-tabbar` | `div` | A tab group's strip. | none |
| `.jali-tabs-pinned` | `div` | The strip's pinned tabs, which stay in view while the rest scroll. | none |
| `.jali-tab-item` | `div` | One tab with its buttons. | `data-pinned`: Flag: a pinned tab.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`).<br>`data-drop`: While a tab is dragged along the strip: `before` or `after`, where it will land.<br>`data-renaming`: Flag: the rename field has taken the tab's place. |
| `.jali-tab` | `div` | A tab (`role="tab"`). Its `::before` and `::after` are yours: Jali's styles never use them, so a lamp, a badge or a stripe drawn there stays. | `data-tab`: The pane's id.<br>`aria-selected`: `true` on the shown tab.<br>`data-pinned`: Flag: a pinned tab.<br>`data-folded`: Flag: the layout folded this pane into tabs; it returns when there's room.<br>`data-tucked`: Flag: tucked; shown here until it is put back.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`).<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-tab-title` | `span` | A tab's name, inside `.jali-tab`. Give it `min-width: 0` to let it shrink first when you add to the tab. | none |
| `.jali-tab-close` | `button` | A tab's close button (an unsaved dot until hovered or focused). | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-rename` | `input` | The rename field that takes a tab's (or a lone pane's title's) place while renaming (`createJali({ rename })`). | none |
| `.jali-tab-putback` | `button` | A tucked tab's Put back button. | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-tab-add` | `button` | A tab group's New tab button (with a `launcher`). | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-tab-more` | `button` | The "+N" button for tabs that don't fit. | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-tab-indicator` | `span` | The one underline under the shown tab. | none |
| `.jali-tab-folded` | `button` | The "N folded" chip at the end of a tab strip: the panes the layout folded into this place, but the one it shows. Its menu lists them, each with its activity dot. | `data-activity`: The most pressing activity of the panes behind it (`useActivity`): most pressing first, `failed`, `needs-you`, `working` (loading too), then `live`; absent when all are idle. The chip shows the shelf's shape for it (`activityShape`).<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |

## Dividers

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `[data-divider]` | `div` | A divider between panes (`role="separator"`); drag it to resize. | `aria-orientation`: `vertical` between side-by-side panes, `horizontal` between stacked ones. |
| `.jali-divider-line` | `span` | The line inside a divider, drawn while it is pointed at or dragged (in `--jali-border-strong`). Transparent at rest. | none |

## Drag and drop

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `[data-drop-zone]` | `div` | The preview of where a dragged pane will go; the value is `left`, `right`, `top`, `bottom` or `centre`. | none |
| `.jali-drag-chip` | `div` | The chip that follows the pointer while a pane is dragged. | none |

## Shelf

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-shelf` | `div` | The panes you tucked, as chips (`<Shelf />`). Folded panes wait behind their strip's `tabFolded` chip. | none |
| `.jali-shelf-chip` | `div` | A chip on the shelf. | `data-chip`: The pane's id.<br>`data-reason`: `tucked`.<br>`data-activity`: The pane's activity (`useActivity`): `idle`, `working` (loading too), `live`, `needs-you` or `failed`.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`). |
| `.jali-activity-shape` | `span` | A pane's activity as a shape as well as a colour, never colour alone: in a shelf chip, the shelf's menu and the "N folded" chip. Absent while idle. Jali draws the ring with a border and a spin, the live dot with a border and a background that breathe, "!" as text and the cross with the `activityError` icon (both in `currentColor`). To draw your own, clear Jali's (`border: 0; animation: none; background: none; color: transparent`) and draw in `::before`. Its `::before` and `::after` are yours: Jali's styles never use them, so a lamp, a badge or a stripe drawn there stays. | `data-activity`: `working` (loading too), `live`, `needs-you` or `failed`, as on the shelf chip and the "N folded" chip.<br>`data-shape`: Jali's shape for it: `ring`, `dot` (live), `need` ("!") or `fail` (a cross). |
| `.jali-shelf-chip-main` | `button` | The chip's main button: the pane's icon, name and marks. Brings the pane back. | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-shelf-chip-title` | `span` | A pane's name, in a chip and in the shelf's menu. | none |
| `.jali-shelf-chip-put` | `button` | A tucked chip's Put back button, shown while the chip is hovered or has focus. | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-shelf-more` | `button` | The "+N" button for chips that don't fit; it opens the shelf's menu. | `aria-expanded`: `true` while its menu is open.<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-shelf-menu` | `div` (`role="menu"`) | The shelf's menu of the chips that don't fit. | none |
| `.jali-shelf-menu-item` | `button` (`role="menuitem"`) | One pane in the shelf's menu. | `data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |

## Linked panes

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-peek` | `aside` | The peek sheet: a linked object shown over the panes. | none |
| `.jali-follow-toggle` | `button` | A linked pane's one Following / Kept toggle (a button, not a container): a click switches. Its word is `followLabel`. | `data-follow`: `following`, `kept` or `plain`.<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-follow-label` | `span` | The toggle's printed word, "Following" or "Kept" (its icon stays when a narrow header hides the word). | none |
| `.jali-kept-badge` | `span` | "Kept" on a kept pane that is no longer linked to a list, in place of the toggle. | none |

## Dialogs and menus

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-tab-menu` | `div` | A tab's menu, and the "+N" menu. | none |
| `[data-menu-item]` | `button` | An item in a tab's menu; the value is the item's id (Jali's, or yours from `tabMenu`). | `aria-checked`: On a checkbox item: `true` or `false`.<br>`aria-disabled`: `true` when unavailable.<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-palette-item` | `li` | A command in ⌘K, or an entry in the "Add to tabs of…" chooser. | `data-command-id`: In ⌘K: the command's id.<br>`aria-selected`: `true` on the highlighted entry.<br>`aria-disabled`: `true` when unavailable. |
| `.jali-scrim` | `div` | A dialog's backdrop, holding the dialog (`dialogBox`): the palette, Settings, the "Add to tabs of…" chooser and the discard question. | none |
| `.jali-dialog` | `div` (`role="dialog"`, or `"alertdialog"` for the discard question) | The dialog itself, inside its scrim. | `data-dialog`: `palette` (⌘K), `chooser` ("Add to tabs of…" and `actions.choose`), `settings` or `confirm` (the discard question). |
| `.jali-setting` | `label` | A row in Settings: a radio or checkbox and its words on one line (`<label class="jali-setting"><input type="radio" /> <span>Dark</span></label>`). Put the class on your own fieldsets' rows (`<SettingsPanel>` children, `<JaliRoot settingsExtra>`) and they match Jali's. | none |
| `.jali-dialog-button` | `button` | A button in a dialog's footer (the discard question's Discard and Keep editing). | `data-role`: `primary` (the safe choice, focused when it opens) or `secondary`.<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `.jali-palette` | `div` | The ⌘K and chooser dialog (also `.jali-dialog`): its field, then its list. | none |
| `.jali-palette-input` | `input` (`role="combobox"`) | The palette's and the chooser's search field. | none |
| `.jali-palette-name` | `span` | A row's name: the command's title, or the entry's label. | none |
| `.jali-palette-group` | `span` | In ⌘K: the command's group label ("Focus", "Layout", or yours). | none |
| `.jali-palette-hint` | `span` | In the chooser: the entry's hint, after its name. | none |
| `.jali-palette-keys` | `kbd` | In ⌘K: the command's keys, when it has any. | none |

## Small screens

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-fold-line` | `div` | The hairline drawn on a fold's hinge, between the two halves. | none |
| `.jali-stack-divider` | `div` | Stacked view's divider between the two panes on a phone (`role="separator"`): the whole room between them, at least 24px tall, so it never covers either pane. It settles on a third, a half or two thirds. | `data-dragging`: Flag: being dragged. |
| `.jali-switcher` | `nav` | Single view's pane switcher (a tab list). | none |
| `.jali-switch-item` | `button` | One pane in the switcher. Its `::before` and `::after` are yours: Jali's styles never use them, so a lamp, a badge or a stripe drawn there stays. | `aria-selected`: `true` on the pane in view.<br>`data-tucked`: Flag: a tucked pane.<br>`data-in-view`: Flag: in stacked view, the other pane on screen.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`).<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |

## Curated pages

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `.jali-page` | `div` | A curated page's root, in the workspace's place: the page's `Rail` (when it renders one) and its main column, which holds the item's `Header`, the views' tabs (in a `nav` landmark named for the page, "Loan review views") and the panes. Style the page's frame here: its background, the rail's width (`grid-template-columns`), spacing. | none |
| `.jali-page-bar` | `div` | A curated page's bar: its roles, Single view or Split view, Reset. | none |
| `.jali-page-tab` | `button` | One role on a curated page's bar. | `data-role`: The role's id.<br>`data-state`: `focused`, `shown`, `behind` (open, not in view) or `off` (not open).<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |

## Icons and your chrome

| Part | Element | What it is | State attributes |
| --- | --- | --- | --- |
| `[data-jali-icon]` | `svg` | One of Jali's own icons; the value is its name (`close`, `pin`…). Your icons carry what you give them. | none |
| `.jali-icon-btn` | `button` | A button that is only an icon: each of a pane header's buttons (also `paneAction`), Reset on a curated page's bar, and the close buttons of the peek sheet and Settings. `<IconButton>` renders one for your own chrome, so your buttons match Jali's in every theme. | `aria-pressed`: On a toggle: `true` while on.<br>`disabled`: Flag: it can't be used now.<br>`data-pressed`: Flag: held down, by the pointer or by Space or Enter while it has focus (`:active` covers only the pointer). Jali's styles don't read it. |
| `[data-jali-chrome]` | `any` | Yours to set: your own chrome inside the root, which Jali never pulls focus out of. | none |
