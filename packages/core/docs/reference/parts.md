# Parts

Every part of the workspace you can style, its selector, and the attributes that carry its state.

These are the parts of what Jali renders that your styles may rely on. Each has one selector, a `jali-` class or a `data-` attribute, and carries its state in attributes, never in classes: select `.jali-pane[data-focused]`, `.jali-tab[aria-selected="true"]` or `.jali-shelf-chip[data-reason="folded"]`.

Everything on this page is public, and changes only in a major version. Other `jali-*` classes, any `is-*` class, and attributes not listed are Jali's own and may change in any release. Put your rules in a cascade layer after `jali`, as in [Theming](../guides/theming.md#the-layer-line), so they win without `!important`.

```css
@layer components {
  .jali-pane[data-kind="ticket"][data-focused] {
    box-shadow: 0 0 0 2px var(--jali-accent);
  }
  .jali-tab[data-pinned] {
    font-weight: 600;
  }
  .jali-shelf-chip[data-activity="needs-you"] {
    outline: 1px solid var(--jali-blocked);
  }
}
```

With Tailwind, the same attributes work as variants: `data-[focused]:ring-2`, or `group-data-[zoomed]:hidden` inside a pane.

Attributes a pane sets with `usePaneAttributes` appear on everything that stands for it (its section, tab, shelf chip and switcher entry), alongside these.

| Part | What it is | State attributes |
| --- | --- | --- |
| `[data-jali]` | The workspace's root: the element `<JaliRoot>` renders, with your `className`. | none |
| `[data-jali-layer]` | Beside the root, holding the workspace's dialogs and live region. | none |
| `.jali-workspace` | The area the panes are laid out in. | `data-single`: Flag: Single view (one pane at a time, with the switcher).<br>`data-zoomed`: Flag: a pane is maximised.<br>`data-alone`: Flag: one pane on screen, shown full-bleed with no tuck, maximise or drag.<br>`data-page`: On a curated page: `split` or `single`, the page's mode. |
| `.jali-pane` | A pane (a `<section>` region). | `data-pane`: The pane's id.<br>`data-kind`: The pane's kind.<br>`data-focused`: Flag: the focused pane.<br>`data-alone`: Flag: the only pane on screen (see the workspace's).<br>`data-zoomed`: Flag: maximised.<br>`data-dragged`: Flag: being dragged.<br>`data-drop-target`: Flag: the pane a drag would drop on.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`).<br>`data-origin`: `opened`: opened beside another from a link; `role`: fills a curated page's role.<br>`data-boundary`: On an opened pane: how it shows it was opened from another, the person's setting (`tint` or `none`). |
| `.jali-pane-header` | A pane's header: title, tabs and buttons. | none |
| `.jali-pane-title` | The title of a pane on its own (no tabs): icon, name, marks. | none |
| `.jali-pane-actions` | The header's buttons: tuck, maximise, close. | none |
| `.jali-pane-content` | Where the kind's `Component` renders. | none |
| `.jali-tabbar` | A tab group's strip. | none |
| `.jali-tabs-pinned` | The strip's pinned tabs, which stay in view while the rest scroll. | none |
| `.jali-tab-item` | One tab with its buttons. | `data-pinned`: Flag: a pinned tab.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`).<br>`data-drop`: While a tab is dragged along the strip: `before` or `after`, where it will land.<br>`data-renaming`: Flag: the rename field has taken the tab's place. |
| `.jali-tab` | A tab (`role="tab"`). | `data-tab`: The pane's id.<br>`aria-selected`: `true` on the shown tab.<br>`data-pinned`: Flag: a pinned tab.<br>`data-folded`: Flag: the layout folded this pane into tabs; it returns when there's room.<br>`data-tucked`: Flag: tucked; shown here until it is put back.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`). |
| `.jali-tab-close` | A tab's close button (an unsaved dot until hovered or focused). | none |
| `.jali-tab-putback` | A tucked tab's Put back button. | none |
| `.jali-tab-add` | A tab group's New tab button (with a `launcher`). | none |
| `.jali-tab-more` | The "+N" button for tabs that don't fit. | none |
| `.jali-tab-indicator` | The one underline under the shown tab. | none |
| `.jali-tab-menu` | A tab's menu, and the "+N" menu. | none |
| `[data-menu-item]` | An item in a tab's menu; the value is the item's id (Jali's, or yours from `tabMenu`). | `aria-checked`: On a checkbox item: `true` or `false`.<br>`aria-disabled`: `true` when unavailable. |
| `[data-divider]` | A divider between panes (`role="separator"`); drag it to resize. | `aria-orientation`: `vertical` between side-by-side panes, `horizontal` between stacked ones. |
| `[data-drop-zone]` | The preview of where a dragged pane will go; the value is `left`, `right`, `top`, `bottom` or `centre`. | none |
| `.jali-drag-chip` | The chip that follows the pointer while a pane is dragged. | none |
| `.jali-shelf` | Tucked and folded panes, as chips (`<Shelf />`). | none |
| `.jali-shelf-chip` | A chip on the shelf. | `data-chip`: The pane's id.<br>`data-reason`: `tucked` or `folded`.<br>`data-activity`: The pane's activity (`useActivity`): `idle`, `working` (loading too), `needs-you` or `failed`.<br>`data-summary`: Flag: the one "N folded" chip that stands for several.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`). |
| `.jali-switcher` | Single view's pane switcher (a tab list). | none |
| `.jali-switch-item` | One pane in the switcher. | `aria-selected`: `true` on the pane in view.<br>`data-tucked`: Flag: a tucked pane.<br>`data-unsaved`: Flag: the pane reports unsaved work (`useUnsaved`). |
| `.jali-peek` | The peek sheet: a linked object shown over the panes. | none |
| `.jali-page-bar` | A curated page's bar: its roles, Single view or Split view, Reset. | none |
| `.jali-page-tab` | One role on a curated page's bar. | `data-role`: The role's id.<br>`data-state`: `focused`, `shown`, `behind` (open, not in view) or `off` (not open). |
| `.jali-follow-toggle` | A linked pane's Following and Keep control. | `data-follow`: `following`, `kept` or `plain`. |
| `.jali-palette-item` | A command in ⌘K, or an entry in the "Add to tabs of…" chooser. | `data-command-id`: In ⌘K: the command's id.<br>`aria-selected`: `true` on the highlighted entry.<br>`aria-disabled`: `true` when unavailable. |
| `[data-jali-icon]` | One of Jali's own icons; the value is its name (`close`, `pin`…). Your icons carry what you give them. | none |
| `[data-jali-chrome]` | Yours to set: your own chrome inside the root, which Jali never pulls focus out of. | none |
