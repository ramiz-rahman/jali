# Tokens

Every public --jali-* token, what reads it, its light and dark values, and how the Tailwind bridge maps it.

Jali's styles read only `--jali-*` custom properties. Set any of them on `:root` or on a subtree to retheme; the derived tokens follow the accent. Names starting `--jali-default-` are the theme's internal palette: don't set or read them. The theme is in the `jali` layer, so set tokens outside any layer or in a layer after `jali`.

Every token is declared once, on the root, inside `:where()`, so your own declaration wins at any specificity and in any import order, wherever you set it: on `:root`, on any element around a workspace, or on its root (`[data-jali]`), with any theme scope in between. Jali's defaults are `light-dark()` pairs, resolved by the `color-scheme` where they are used: dark under `prefers-color-scheme: dark` and inside a `.dark` or `[data-theme="dark"]` scope, light inside `.light` or `[data-theme="light"]`. A started workspace sets `data-theme` on `<html>` from the theme setting, unless it was made with `pageTheme: false`.

```css
:root { --jali-accent: #0f766e; }                  /* the whole page */
.orders-workspace { --jali-radius: 0.25rem; }      /* one workspace */
```

Each row below gives the token, what it is for, and the `jali-*` classes whose rules read it (taken from the package's styles). Its swatches are drawn from the variable itself, in a light and a dark scope.

## Surfaces

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-canvas` | The ground behind the panes. Jali paints nothing with it except the selected button of the Single / Split view switch; give your page this background to match. | `#efeae2` | `#0e0d0b` |
| `--jali-surface` | Panes, the peek sheet, dialogs, menus, the page tabs and the phone's pane switcher. | `#fdfcfa` | `#1a1815` |
| `--jali-surface-raised` | Dialogs and menus: the palette, the chooser, Settings, the discard dialog, the tab overflow menu and the shelf's menu. | `#ffffff` | `#221f1b` |
| `--jali-border` | Hairlines: pane edges, pane headers, shelf chips, dialog and palette borders. | `#e4ded4` | `#2d2a25` |
| `--jali-border-strong` | Stronger lines: the tab overflow button and menu, and a divider under the pointer. | `#d3cbbd` | `#3f3a33` |
| `--jali-control` | Boundaries of controls (text buttons, the pane cap input). At least 3:1 against the surface, unlike the decorative border. | `#8a8274` | `#7b7468` |
| `--jali-hover` | The background of a control under the pointer: icon buttons, tab buttons, shelf chips and menu items. | `#eee9e1` | `#24211d` |

## Text

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-text` | Primary text: pane titles, the active tab, menu items and inputs. | `#1c1915` | `#f1ece4` |
| `--jali-text-muted` | Secondary text: shelf chips, keyboard hints in the palette, dialog body text. | `#4f4941` | `#bfb7aa` |
| `--jali-text-subtle` | Quieter text and icons: inactive tabs, icon buttons, palette groups, settings legends. Folded and tucked marks use it (at least 3:1). | `#685f54` | `#a1998c` |
| `--jali-text-faint` | The faintest marks: drag grips, the loading dot, a tab's close button, disabled palette rows. | `#a1998c` | `#6c655b` |

## Accent

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-accent` | Focus and action: the focused pane's edge, a zoomed pane, divider handles, the drop indicator, the focused page tab, primary buttons. | `#4456c7` | `#8c9bea` |
| `--jali-on-accent` | Text on the accent: the drop label and primary buttons. | `#ffffff` | `#0e0d0b` |
| `--jali-accent-soft` | A soft accent fill, for the host (the example apps and the docs use it). Part of the palette and mapped by the Tailwind bridge; Jali's own styles mix their tints from the accent instead. | `#e8eaf6` | `#20244a` |
| `--jali-brand` | Nil for the mark (#2B3990 in light), for a host that draws a logo. Part of the palette; Jali draws no mark. | `#2b3990` | `#8c9bea` |

## Status

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-working` | A pane reporting "working": its activity dot and the shelf's spinning ring. | `#0e7490` | `#22d3ee` |
| `--jali-blocked` | A pane reporting "needs-you": its activity dot and the shelf's "!" mark. | `#d97706` | `#fbbf24` |
| `--jali-failed` | A pane reporting "error": its activity dot and the shelf's cross. | `#dc2626` | `#f87171` |
| `--jali-done` | A finished state, for the host's own status marks. Part of the palette; a pane's activity has no "done". | `#059669` | `#34d399` |
| `--jali-on-status` | The "!" and cross drawn on the shelf's status marks. | `#ffffff` | `#0e0d0b` |

## Opened panes

Panes opened by following links in a curated page.

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-opened-bg` | In a curated page, the header of a pane opened while investigating (with the "tint" boundary setting), and the Investigating group in the page bar. | `#fbf8f1` | `#211d15` |
| `--jali-opened-line` | The edge and header line of an opened pane, its "Opened" tag and the Investigating group. | `#eadfc8` | `#3d3424` |
| `--jali-opened-mark` | The small square in the page bar's Investigating group. | `#c08a2e` | `#d9a648` |
| `--jali-opened-ink` | The text of an opened pane's "Opened" tag. | `#8a6420` | `#e2bd78` |

## Overlays and shadows

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-chip` | The chip that follows the pointer during a drag. | `#1c1915` | `#f1ece4` |
| `--jali-on-chip` | Text on the drag chip. | `#ffffff` | `#0e0d0b` |
| `--jali-scrim` | The dim behind the command palette and the "Add to tabs of…" chooser. | `rgba(28, 25, 21, 0.16)` | `rgba(0, 0, 0, 0.55)` |
| `--jali-scrim-light` | The lighter dim behind Settings and "Discard unsaved changes?". | `rgba(28, 25, 21, 0.08)` | `rgba(0, 0, 0, 0.4)` |
| `--jali-shadow-zoom` | A maximised (zoomed) pane. | `0 12px 32px rgba(28, 25, 21, 0.1)` | `0 12px 32px rgba(0, 0, 0, 0.5)` |
| `--jali-shadow-peek` | The peek sheet. | `-8px 0 24px rgba(28, 25, 21, 0.08), 0 1px 2px rgba(28, 25, 21, 0.04)` | `-8px 0 24px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.3)` |
| `--jali-shadow-dialog` | The palette, Settings and the discard dialog. | `0 16px 48px rgba(28, 25, 21, 0.16)` | `0 16px 48px rgba(0, 0, 0, 0.6)` |
| `--jali-shadow-menu` | The tab overflow menu and the shelf's menu. | `0 8px 24px rgba(0, 0, 0, 0.16)` | `0 8px 24px rgba(0, 0, 0, 0.5)` |
| `--jali-shadow-chip` | The drop label and a divider's size tip. | `0 4px 16px rgba(0, 0, 0, 0.18)` | `0 4px 16px rgba(0, 0, 0, 0.5)` |
| `--jali-shadow-raised` | A slight lift, for the host's raised controls (a pressed segment). Part of the palette; Jali's own surfaces use the stronger shadows. | `0 1px 2px rgba(28, 25, 21, 0.06)` | `0 1px 2px rgba(0, 0, 0, 0.4)` |

## Shape and type

One set for both themes.

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-radius` | Corners of panes, the peek sheet, the drop indicator and the tab-preview outline. Dialogs (the palette, the chooser, Settings and the discard question) are 1.2 × this, rounded down to a whole pixel. | `0.625rem` | `0.625rem` |
| `--jali-radius-control` | Corners of buttons, inputs, palette rows, the drag chip and the tab preview's label. | `0.375rem` | `0.375rem` |
| `--jali-radius-menu` | Corners of menus and the drop label. | `0.5rem` | `0.5rem` |
| `--jali-radius-chip` | Corners of small things inside a header, tab or chip: the Following / Kept toggle, a tab's close button, the rename field, the Kept badge and the peek's label. Shelf chips and their buttons, the shelf's "more" and its items, and tab menu items are 1.25 × this; investigation chips 1.75 ×, each rounded down to a whole pixel. | `0.25rem` | `0.25rem` |
| `--jali-font` | The workspace's typeface: the workspace and its dialogs set font-family from it. | `"Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | `"Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| `--jali-font-mono` | Monospace: the pane cap input in Settings. | `"Atkinson Hyperlegible Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace` | `"Atkinson Hyperlegible Mono", ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace` |

## Spacing

Written by Jali, not set by you. The layout measures in pixels, so the space between panes is an option, `createJali({ gap, inset })`, and `<JaliRoot>` writes it on its root and its layer as these two variables. Read them in your own styles to line things up with the panes; setting them in CSS moves nothing.

| Token | What it is | Default |
|---|---|---|
| `--jali-gap` | The space between panes, and the gutter a strip's scrollbar sits in (`createJali({ gap })`). | `6px` |
| `--jali-inset` | The space between the workspace's edges and its panes (`createJali({ inset })`, else the gap). | the gap |

## Derived

Mixed from `--jali-accent` on `:root` and again on every Jali root (`[data-jali]`) and dialog (`.jali-scrim`), so an accent set on a subtree gets matching tints there. Set one yourself to override the mix.

| Token | Used for | Light | Dark |
| --- | --- | --- | --- |
| `--jali-accent-weak` | 8% of the accent (14% in dark): the selected palette row, the active item in the phone's pane switcher, the tab-preview fill. | `color-mix(in srgb, var(--jali-accent) 8%, transparent)` | `color-mix(in srgb, var(--jali-accent) 14%, transparent)` |
| `--jali-accent-mid` | 16% of the accent (26% in dark): the active item in the phone's pane switcher. | `color-mix(in srgb, var(--jali-accent) 16%, transparent)` | `color-mix(in srgb, var(--jali-accent) 26%, transparent)` |
| `--jali-drop` | 12% of the accent (16% in dark): the zone a drag will drop into. | `color-mix(in srgb, var(--jali-accent) 12%, transparent)` | `color-mix(in srgb, var(--jali-accent) 16%, transparent)` |
| `--jali-focus-ring` | Keyboard focus outlines on tab buttons, shelf chips and the follow toggle. The accent unless you set it. | `var(--jali-accent)` | `var(--jali-accent)` |

## The Tailwind bridge

`@jali/react/tailwind.css` points Jali's tokens at your Tailwind theme's variables, the same names Chakni reads. Import it after Jali's styles, in the stylesheet Tailwind builds, and declare the layer order so your utilities win:

```css
@layer theme, base, jali, components, utilities;
@import "tailwindcss";
@import "@jali/react/styles.css";
@import "@jali/react/tailwind.css";
```

Each token reads the first of your variables that is defined, else Jali's own default for the current theme. Your variables switch with your dark mode, so Jali follows. Tailwind drops theme variables that nothing uses; this file uses them, so keep it in the build Tailwind processes (or mark the theme `@theme static`). Tokens not listed keep Jali's values.

| Jali token | Reads from your theme, first found | Else |
| --- | --- | --- |
| `--jali-canvas` | `--color-background` | `var(--jali-default-canvas)` |
| `--jali-surface` | `--color-card` | `var(--jali-default-surface)` |
| `--jali-surface-raised` |  | `var(       --color-popover,       var(--color-card, var(--jali-default-surface-raised))     )` |
| `--jali-border` | `--color-border` | `var(--jali-default-border)` |
| `--jali-border-strong` |  | `var(       --color-input,       var(--color-border, var(--jali-default-border-strong))     )` |
| `--jali-control` | `--color-input` | `var(--jali-default-control)` |
| `--jali-text` | `--color-foreground` | `var(--jali-default-text)` |
| `--jali-text-muted` |  | `var(       --color-muted-foreground-strong,       var(--color-muted-foreground, var(--jali-default-text-muted))     )` |
| `--jali-text-subtle` | `--color-muted-foreground` | `var(--jali-default-text-subtle)` |
| `--jali-text-faint` | `--color-muted-foreground` | `var(--jali-default-text-faint)` |
| `--jali-hover` | `--color-muted` | `var(--jali-default-hover)` |
| `--jali-accent` | `--color-primary` | `var(--jali-default-accent)` |
| `--jali-accent-soft` | `--color-primary-subtle` | `var(--jali-default-accent-soft)` |
| `--jali-on-accent` | `--color-primary-foreground` | `var(--jali-default-on-accent)` |
| `--jali-failed` | `--color-destructive` | `var(--jali-default-failed)` |
| `--jali-chip` | `--color-tooltip` | `var(--jali-default-chip)` |
| `--jali-on-chip` | `--color-tooltip-foreground` | `var(--jali-default-on-chip)` |
| `--jali-scrim` | `--color-scrim` | `var(--jali-default-scrim)` |
| `--jali-shadow-dialog` | `--shadow-overlay` | `var(--jali-default-shadow-dialog)` |
| `--jali-shadow-menu` | `--shadow-overlay` | `var(--jali-default-shadow-menu)` |
| `--jali-radius` | `--radius-card`, then `--radius-lg` | `0.625rem` |
| `--jali-radius-control` | `--radius-control`, then `--radius-md` | `0.375rem` |
| `--jali-radius-menu` | `--radius-md` | `0.5rem` |
| `--jali-radius-chip` | `--radius-sm` | `0.25rem` |
| `--jali-font` | `--font-sans` | `system-ui, sans-serif` |
| `--jali-font-mono` | `--font-mono` | `ui-monospace, monospace` |
| `--jali-focus-ring` | `--color-focus-ring`, then `--color-ring` | `var(--jali-accent)` |
