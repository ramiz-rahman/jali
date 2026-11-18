# @jali/react

React for [Jali](../core) workspaces, with Jali's default theme.

```tsx
import { Jali, JaliView, definePaneKind } from "@jali/react";
import "@jali/react/styles.css";

const note = definePaneKind({
  kind: "note",
  title: (ref) => `Note ${ref.params.id}`,
  ref: (params) => ({ kind: "note", params }),
  minWidth: 240,                 // narrower than this, the pane folds into a tab
  minHeight: 160,
  Component: ({ ref, openBeside }) => <article>Note {ref.params.id}</article>,
});

// store: createUiStore({ kinds: createPaneKinds([note]), ... }) from @jali/core
<Jali store={store} className="app">
  <MyTopBar />
  <JaliView />
</Jali>;
```

## Theming

Everything Jali draws reads `--jali-*` tokens and sits in the `jali` cascade layer. Declare the layer order once and your own styles win without `!important`:

```css
@layer theme, base, jali, components, utilities;
```

- **Your Tailwind theme:** also import `@jali/react/tailwind.css`. It points Jali's tokens at your theme's (`--color-primary`, `--color-card`, `--color-border`, `--radius-card`, …), the same names Chakni reads.
- **By hand:** set any `--jali-*` token on `:root` or a subtree (`--jali-accent: #0f766e;`). Dark mode follows `prefers-color-scheme`, `.dark` or `[data-theme="dark"]`.
- **Type:** Jali's face is Atkinson Hyperlegible: Next for text, Mono for code (`--jali-font`, `--jali-font-mono`). Jali doesn't bundle font files; load them (for example `@fontsource/atkinson-hyperlegible-next` and `-mono`) or set the tokens to your own faces.
- **Parts** carry their state as attributes (`data-pane`, `data-focused`, `aria-selected`, `data-drop-zone`) and every class is `jali-*`, so a utility class on a part is enough.

See `examples/minimal` for the smallest working app.
