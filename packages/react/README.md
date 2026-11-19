# @jali/react

React for [Jali](../core) workspaces, with Jali's default theme.

```sh
npm install @jali/core @jali/react @phosphor-icons/react
```

React 19 is a peer dependency, and so is `@phosphor-icons/react` (optional).

**Linked or in a monorepo** (`link:`, `file:`, `workspace:` or a symlinked checkout): the package can resolve its own copy of React from beside its source, and the app then bundles two Reacts, which breaks hooks ("Invalid hook call"). With Vite, tell it to use the app's: `resolve: { dedupe: ["react", "react-dom"] }` in `vite.config.ts`. With webpack, alias `react` and `react-dom` to the app's copy (`resolve.alias`).

Jali's icons are Phosphor's regular weight, the set Chakni uses; give a kind any Phosphor icon (`icon: FileTextIcon`) and it matches.

## Icons

- `<JaliRoot icons={{ close: MyClose }}>` replaces any of Jali's icons by name; the rest stay Phosphor's. `useJaliIcons()` returns the set in use.
- `@jali/react/bare` is the same API without Phosphor: `<JaliRoot icons>` takes every icon (`JaliIcons`, checked by the types), so Phosphor is never installed or bundled. `@jali/react/icons` exports `phosphorIcons`, the full default map.
- Each icon is a component taking `{ size, className, "aria-hidden" }`. The names are in the reference (Icons).

```tsx
import { createJali, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import "@jali/react/styles.css";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 240 }, // narrower than this, the pane folds into a tab

  Component: ({ params, openBeside }) => (
    <button onClick={() => openBeside(note({ id: params.id + 1 }))}>Note {params.id}</button>
  ),
});

const jali = createJali({ panes: [note], layout: row(note({ id: 1 }), note({ id: 2 })) });

<JaliRoot jali={jali} className="app" />;
```

Inside a pane, `usePane()` reads its props from any depth, and `useActivity`, `useUnsaved`, `useCommands` and `usePaneState` report to the workspace.

## Theming

Everything Jali draws reads `--jali-*` tokens and sits in the `jali` cascade layer. Declare the layer order once and your own styles win without `!important`:

```css
@layer theme, base, jali, components, utilities;
```

- **Your Tailwind theme:** also import `@jali/react/tailwind.css`. It points Jali's tokens at your theme's (`--color-primary`, `--color-card`, `--color-border`, `--radius-card`, …), the same names Chakni reads.
- **By hand:** set any `--jali-*` token on `:root`, on any element around the workspace, or on its root (`--jali-accent: #0f766e;`, or `light-dark(#0f766e, #2dd4bf)` for both themes). Your value wins there and below, whatever theme scope sits in between. Dark mode follows `prefers-color-scheme`, `.dark` or `[data-theme="dark"]`: those switch Jali's default palette, never a token you set.
- **Type:** Jali's face is Atkinson Hyperlegible: Next for text, Mono for code (`--jali-font`, `--jali-font-mono`). Jali doesn't bundle font files; load them (for example `@fontsource/atkinson-hyperlegible-next` and `-mono`) or set the tokens to your own faces.
- **Parts** carry their state as attributes (`data-pane`, `data-kind`, `data-focused`, `aria-selected`, `data-drop-zone`) and every class is `jali-*`. Parts take no `className`: style them with your own rule on those classes and attributes (`.jali-pane[data-focused] { … }`, or in Tailwind `@apply` inside such a rule). Since Jali's rules are in the `jali` layer, yours win without `!important`. `<JaliRoot className>` styles the root.

See `examples/minimal` for the smallest working app.
