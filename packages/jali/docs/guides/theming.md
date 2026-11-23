# Theming

Make Jali match your app by setting a few tokens, mapping them from your Tailwind theme, or styling its parts.

Everything Jali draws reads `--jali-*` CSS variables, called tokens. Change a token and every part that uses it follows, in light and in dark. Jali's own rules sit in a cascade layer called `jali`, so your rules can win without `!important`.

## Load the styles

```ts
import "jali/styles.css";
```

This brings Jali's default theme and the panes' styles. It is plain CSS: no Tailwind or build step needed. From a stylesheet, `@import "jali/styles.css";` does the same, as the next section does; it works in Vite and any bundler that reads a package's `exports`. `theme.css` and `tailwind.css` import the same way.

## The layer line

Cascade layers are ordered by where each name first appears. Declare yours, with `jali` among them, before Jali's CSS loads. The surest way is one stylesheet that starts with the layer line and then imports Jali:

`src/app.css`

```tsx
/* app.css, the one stylesheet your app imports. The layer line comes first, before Jali's CSS is loaded. */
@layer base, jali, components;
@import "jali/styles.css";
@import "./teal.css";

@layer base {
  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }
  body {
    background: var(--jali-canvas);
    color: var(--jali-text);
    font-family: var(--jali-font);
  }
}
```

Import only `app.css` from your code. Rules in a layer after `jali` (here `components`) beat Jali's at any specificity. Rules in a layer before it (`base`, for page resets) lose to Jali's, so a reset like `button { font: inherit }` can't undo Jali's type sizes. Jali's root is a flex column that fills its box, so a rule that lays out the element you pass `className` to (a grid of top bar, panes and status line) belongs in a layer after `jali`, or outside any layer.

> **Warning: Order matters.** If Jali's CSS loads first, `jali` becomes the first layer, and every layer you name after it beats Jali, resets included.

## Set tokens by hand

Set any public token on `:root`, or on any element to theme just that part of the page: an element around Jali's root, or the root (`[data-jali]`) itself. Jali declares each token once, on the root, with zero specificity, so your declaration wins in any order, and it still wins inside a `.dark` or `.light` element below it.

The tokens you are most likely to change:

| Token | Used for |
|---|---|
| `--jali-accent` | The focused pane's edge, the selected tab, primary buttons, drop previews |
| `--jali-accent-soft`, `--jali-on-accent` | Soft fills behind accented things; text on the accent |
| `--jali-canvas` | Behind the panes |
| `--jali-surface`, `--jali-surface-raised` | Panes; menus and dialogs |
| `--jali-border`, `--jali-border-strong`, `--jali-control` | Lines between things; the edges of buttons and inputs |
| `--jali-text`, `--jali-text-muted`, `--jali-text-subtle`, `--jali-text-faint` | Text, from strongest to faintest |
| `--jali-pane-border`, `--jali-pane-border-focused`, `--jali-pane-shadow`, `--jali-pane-shadow-focused` | A pane's edge and shadow, at rest and focused. Set them once and the focused pane, a maximised one and a drag follow, with no rule for `[data-focused]` of your own |
| `--jali-working`, `--jali-live`, `--jali-blocked`, `--jali-done`, `--jali-failed` | A pane's activity marks. To draw marks of your own, style the parts `.jali-activity` and `.jali-activity-shape` by their `data-activity` ([Parts](../reference/parts.md)) |
| `--jali-radius`, `--jali-radius-control`, `--jali-radius-menu`, `--jali-radius-chip` | Corners of panes, controls, menus and the small things in headers, tabs and chips. Every corner reads one of them (a dialog is 1.2 × `--jali-radius`, rounded to a whole pixel), so setting all four to `0` or `2px` squares everything Jali draws |
| `--jali-dialog-padding` | The space inside a dialog, between its edge and its content |
| `--jali-font`, `--jali-font-mono` | Type |
| `--jali-text-xs`, `--jali-text-sm`, `--jali-text-md`, `--jali-text-lg`, `--jali-tracking` | The type scale every part reads (11, 12, 13 and 14px by default), and letter spacing. A wider face needs only these, not a size per part |
| `--jali-icon-header`, `--jali-icon-tab`, `--jali-icon-menu`, `--jali-icon-shelf` | Icon sizes by place: a pane's header, a tab, menus, shelf chips. They size your own `icons` too, as long as your icon applies the `className` Jali passes it (Phosphor's, Lucide's and most sets' do) |

Every token, with its light and dark values, is in the [Tokens reference](../reference/tokens.md).

## Spacing

The space between panes is an option, because the layout measures with it: `createJali({ gap: 3 })`. It defaults to 6px, and the space between Jali's edges and its panes is always the same. Jali writes it on its root as `--jali-gap` and `--jali-inset`, so your own bars can line up with the panes (`padding-inline: var(--jali-inset)`).

The accent's tints (`--jali-accent-weak`, `--jali-accent-mid`, `--jali-drop` and the focus ring) are mixed from `--jali-accent` on each instance's root. Change the accent and they follow, on the whole page or on one instance. For one instance, set it on an element around `<JaliRoot>`: the palette, the other dialogs and the tab menus render in a layer beside Jali's root (`[data-jali-layer]`), not inside it, so an accent set on the root itself reaches the panes but not them.

## Example: retheme to teal

Jali's default accent is indigo. Here it is teal, with a lighter teal in dark mode:

`src/teal.css`

```tsx
/* Teal for Jali, in light and dark. Plain CSS in your app's stylesheet. */

/* Once, on the root. light-dark(light, dark) picks a side wherever the token is used: dark when the system asks for it,
   or inside a .dark or data-theme="dark" element, and light inside a .light or data-theme="light" one. */
:root {
  --jali-accent: light-dark(
    #0f766e,
    #2dd4bf
  ); /* focus edge, selected tab, primary buttons, drop preview */
  --jali-accent-soft: light-dark(#e6f4f1, #123b37); /* soft fills behind accented things */
  --jali-on-accent: light-dark(#ffffff, #042f2e); /* text on the accent */
  --jali-brand: light-dark(#115e59, #5eead4);
}
```

`light-dark(light, dark)` gives a token both values at once (Baseline 2024: Chrome 123, Firefox 120, Safari 17.5). The browser picks one wherever the token is used, by that element's `color-scheme`, which Jali sets for each theme scope (below). A token with one value, such as `--jali-accent: #0f766e`, is the same in light and dark.

## Dark mode

Jali's default palette switches to dark (Jali sets `color-scheme: dark`, and every default is a `light-dark()` pair):

- when the system prefers dark, unless the page or a parent says light (`.light` or `data-theme="light"`);
- inside a `.dark` element or a `data-theme="dark"` one, whatever the system says.

A theme scope switches only Jali's defaults. A token you set yourself, on `:root` or any element above the scope, is kept inside it. If your app sets `color-scheme` itself, Jali's defaults follow yours.

Jali also has its own theme setting (System, Light or Dark, in its settings panel), and a started instance writes the result to `data-theme` on `<html>` (unless it was made with `pageTheme: false`). It writes the same on Jali's root (`[data-jali]`) and dialog layer (`[data-jali-layer]`), so a rule can follow the theme inside Jali without reaching for `<html>`. That matters for what `light-dark()` can't switch, such as an image: `[data-jali][data-theme="dark"] .grain { background-image: url(grain-dark.svg); }`. The copy is not a theme scope of its own: whatever sits between `<html>` and Jali's root still decides Jali's colours. If your app has its own light and dark switch, either pass the choice to Jali as well, so the two never disagree, or make the instance with `pageTheme: false` so it never writes `data-theme` (on `<html>`, its root or its layer) and follows your scopes:

`src/theme.ts`

```tsx
import type { ThemeChoice, Jali } from "jali";

/**
 * Your app's own light/dark switch. Jali has a theme setting too (System, Light or Dark in its settings panel), and
 * writes the result to data-theme on <html>. Pass your choice to it, so both always agree.
 */
export function setTheme(jali: Jali, theme: ThemeChoice) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  jali.actions.changeSettings({ theme });
}
```

For a dark-first app, give Jali its first theme with `createJali({ settings: { theme: "dark" } })`. A person who has never chosen gets it; once they choose a theme in the settings panel, their choice is saved and wins.

## From your Tailwind theme

If your app uses Tailwind, import the bridge after Jali's styles. It points Jali's tokens at your theme's variables:

`src/app.css`

```tsx
/* app.css: the stylesheet Tailwind builds. */
@layer theme, base, jali, components, utilities;
@import "tailwindcss";
@import "jali/styles.css";
@import "jali/tailwind.css";

/* Your theme. Jali reads these names (the same ones Chakni reads), each with a fallback to its own default. */
@theme {
  --color-primary: #0f766e;
  --color-primary-foreground: #ffffff;
  --color-card: #ffffff;
  --color-border: #e4e4e7;
  --radius-card: 0.75rem;
}
```

The bridge reads these names, each falling back to Jali's own value when your theme doesn't define it. They are the names Chakni reads too, so an app themed for Chakni gets Jali in the same theme.

| Your theme | Jali token |
|---|---|
| `--color-background` | `--jali-canvas` |
| `--color-card`, `--color-popover` | `--jali-surface`, `--jali-surface-raised` |
| `--color-border`, `--color-input` | `--jali-border`, `--jali-border-strong`, `--jali-control` |
| `--color-foreground`, `--color-muted-foreground` | `--jali-text`, `--jali-text-subtle`, `--jali-text-faint` |
| `--color-muted` | `--jali-hover` |
| `--color-primary`, `--color-primary-subtle`, `--color-primary-foreground` | `--jali-accent`, `--jali-accent-soft`, `--jali-on-accent` |
| `--color-destructive` | `--jali-failed` |
| `--color-ring`, `--color-focus-ring` | the focus ring |
| `--radius-card`, `--radius-control`, `--radius-sm`, `--radius-md`, `--radius-lg` | the radii |
| `--font-sans`, `--font-mono` | `--jali-font`, `--jali-font-mono` |

Your theme's variables switch with your dark mode, so Jali follows. To follow a variable your theme sets again inside a `.dark` element, the bridge declares Jali's tokens again on each theme scope (`.light`, `.dark`, `[data-theme]`). So with the bridge, theme Jali through your theme's variables, or set a `--jali-*` token on the scope element itself. Tailwind drops theme variables that nothing uses; the bridge uses these, so keep it in the stylesheet Tailwind builds, or mark the theme `@theme static`.

## Style the parts

Every class Jali renders starts with `jali-`, so none collide with yours. The parts you may rely on, and the attributes that carry their state, are listed in [Parts](../reference/parts.md): a pane is `.jali-pane` with `data-kind` and `data-focused`, a tab is `.jali-tab` with `aria-selected`, `data-pinned` and `data-folded`, and so on. State is always an attribute, never a class. Only the listed parts and the tokens are stable: anything not listed there, including the elements inside a part (`.jali-pane-actions button`), is Jali's own and may change.

`src/parts.css`

```tsx
/* Rules in a layer after "jali" beat Jali's own, at any specificity, without !important. */
@layer components {
  /* Each part says its state in attributes. */
  .jali-pane[data-focused] {
    box-shadow: 0 0 0 2px var(--jali-accent);
  }
  .jali-pane[data-kind="ticket-note"] {
    background: var(--jali-accent-soft);
  }
  .jali-tab[aria-selected="true"] {
    font-weight: 600;
  }
  .jali-tab[data-folded] {
    font-style: italic;
  }
  [data-drop-zone]::after {
    border-style: dashed;
  }
}
```

With Tailwind, put rules like these in your stylesheet, in a layer after `jali`. Jali's parts don't take class names from your code.

## Your own icons

Jali comes with its own icons, so you install no icon library for them. They are [Phosphor's](https://phosphoricons.com) in the regular weight, copied into the package. To use your app's own, pass `icons` to `<JaliRoot>`, by name: `close`, `maximise`, `tuck`, `fold` and the rest ([every name](../reference/react.md#icons)). Each is a component that takes `size`, `className` and `aria-hidden`; an icon from Phosphor, Lucide or most other React sets is one. Names you leave out stay Jali's. Put `className` on the icon's own element: it carries the size for the icon's place, so the `--jali-icon-*` tokens size your icons as they do Jali's (`size` is the default size, for an icon that ignores `className`).

`src/App.tsx`

```tsx
import type { Jali } from "jali";
import { JaliRoot } from "jali/react";
import { sprite } from "./my-icons";

// Three of Jali's icons, yours; the rest stay Phosphor's.
const icons = {
  close: sprite("x"),
  maximise: sprite("expand"),
  restore: sprite("collapse"),
};

export function App({ jali }: { jali: Jali }) {
  return <JaliRoot jali={jali} icons={icons} />;
}
```

To replace them all, type your set as `JaliIcons`, and the types tell you when one is missing:

`src/my-icons.tsx`

```tsx
import type { JaliIcon, JaliIcons } from "jali/react";

/** Your design system's icons: one SVG sprite, a symbol per icon. */
export const sprite = (id: string): JaliIcon =>
  function SpriteIcon({ size = 16, className, "aria-hidden": hidden }) {
    return (
      <svg width={size} height={size} className={className} aria-hidden={hidden}>
        <use href={`/icons.svg#${id}`} />
      </svg>
    );
  };

/** Every icon Jali draws, from your set. Leave one out and the type says which. */
export const myIcons: JaliIcons = {
  close: sprite("x"),
  maximise: sprite("expand"),
  restore: sprite("collapse"),
  fullScreen: sprite("fullscreen"),
  exitFullScreen: sprite("fullscreen-exit"),
  tuck: sprite("minus"),
  putBack: sprite("undo"),
  newTab: sprite("plus"),
  more: sprite("chevron-down"),
  menu: sprite("more-horizontal"),
  popOut: sprite("picture-in-picture"),
  current: sprite("check"),
  fold: sprite("fold"),
  grip: sprite("grip"),
  follow: sprite("link"),
  keep: sprite("anchor"),
  pin: sprite("pin"),
  activityError: sprite("x-bold"),
  defaultKind: sprite("square"),
  openBeside: sprite("panel-right"),
  addToTabs: sprite("layers"),
  singleView: sprite("square"),
  splitView: sprite("columns"),
  back: sprite("undo"),
  reset: sprite("rotate-ccw"),
  dropLeft: sprite("arrow-left"),
  dropRight: sprite("arrow-right"),
  dropTop: sprite("arrow-up"),
  dropBottom: sprite("arrow-down"),
  dropSwap: sprite("arrows-left-right"),
  dropTab: sprite("square-plus"),
};
```

A kind's own icon is set on the kind (`definePane("order", { icon })`), and the default for a kind without one is `defaultKind`.

## Your chrome inside `<JaliRoot>`

A top bar or status line you render inside `<JaliRoot>` is yours to style. Mark it `data-jali-chrome`. After a layout change Jali moves keyboard focus back to the focused pane, but not out of an element marked this way, so a person using your top bar stays there.

## Right to left

For Arabic, Hebrew, Persian or Urdu, set `dir="rtl"` on the page (or on an element around Jali's root). Jali reads the direction where it renders and follows it if it changes later, so a language switch needs nothing more.

```html filename="index.html"
<html lang="ar" dir="rtl">
```

Right to left, Jali shows the mirror of the same layout:

- A row starts at the right, so reading order, F6 and "Focus next pane" go from right to left.
- Left and right still mean the screen. "Focus pane left" (⌘K ⌘←) goes to the pane on the left of the screen, a drop on a pane's left edge puts the pane on its left, and "Split right" opens the new pane on the right.
- Dividers follow the pointer and the arrow keys, the peek sheet opens on the left, and tab strips, the shelf and menus read from the right.
- The layout and its link are the same in both directions, so a link made in a left-to-right app opens mirrored in a right-to-left one.

To fix the direction instead of reading it, pass `createJali({ dir: "rtl" })`. `<JaliRoot>` then sets `dir` on its own elements, so the styles agree.

Jali's styles use logical properties (`margin-inline-start`, `inset-inline-end`), so they flip with the direction. If you style the parts yourself, do the same.

## Drawing with the tokens on a canvas

A custom property keeps its `light-dark()` pair unresolved: `getComputedStyle(el).getPropertyValue("--jali-text")` returns the string `light-dark(…)`, and a canvas ignores a `fillStyle` it can't parse. To get a colour a canvas can use, let the browser resolve it. Set `color: var(--jali-text)` on an element inside Jali's root and read its computed `color`:

```ts
function resolve(el: HTMLElement, token: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  el.appendChild(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}
```

Resolve again, and redraw, whenever `useJaliTheme()` changes, because the result depends on the theme in force.

## Next

- [Tokens reference](../reference/tokens.md)
- [Use Jali with Chakni](chakni.md)
