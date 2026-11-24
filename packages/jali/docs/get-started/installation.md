# Installation

Add Jali to a React app with Vite, Next.js or another bundler, render it on the server, and set up TypeScript.

## Install

```sh
npm install jali-layout
```

That is the only package. It holds the framework-free core (`jali-layout`), the React parts (`jali-layout/react`), one entry per feature and the styles.

- **React:** 18.2 or later, 18 or 19. React is an optional peer dependency: an app that uses only `jali-layout` (no `jali-layout/react`) needs none.
- **Browsers:** Baseline 2024. Chrome and Edge 123, Firefox 120, Safari 17.5, and Electron 30. The colours are `light-dark()` pairs, the newest CSS Jali needs; older browsers show the panes without their colours.
- **TypeScript:** optional. The types ship in the package. Jali's own code is checked with `strict`.
- **Dependencies:** none at run time.

## Add the styles

Import `jali-layout/styles.css` once, and name the order of your CSS cascade layers before it:

```css filename="app.css"
@layer base, jali;
```

Every rule in Jali's styles sits in the `jali` layer. Your resets go in a layer before it. Your own styles go in a later layer, or outside any layer, and win without `!important`. With Tailwind 4 the line is `@layer theme, base, jali, components, utilities;`. See [Theming](../guides/theming.md).

Jali fills the box you give it, so that box needs a height. In development, a console warning says so when it has none.

## Vite

Nothing to configure. Import the styles from your entry file, after your own stylesheet that holds the `@layer` line:

```tsx filename="src/main.tsx"
import { createRoot } from "react-dom/client";
import { createJali, row } from "jali-layout";
import { JaliRoot, definePane } from "jali-layout/react";
import "./app.css";
import "jali-layout/styles.css";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <article>Note {params.id}</article>,
});

const jali = createJali({ panes: [note], layout: row(note({ id: 1 }), note({ id: 2 })) });

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
```

The [Quickstart](quickstart.md) builds this app step by step.

## Next.js (App Router)

`jali-layout/react` starts with `"use client"`, so its components render inside your server components. The instance itself holds functions, so it can't cross from a server component to a client one. Make it in a client component:

`app/notes/panes.tsx`

```tsx
"use client";
// app/notes/panes.tsx: a client component. The instance is made here, once per render tree, never in a server
// component (it holds functions and can't be passed from server to client).
import { useState } from "react";
import { createJali, memoryLocation, row } from "jali-layout";
import { JaliRoot, definePane } from "jali-layout/react";
import { defaultFeatures } from "jali-layout/features";
import { urlSync } from "jali-layout/url";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <article>Note {params.id}</article>,
});

export function Panes({ search }: { search: string }) {
  const [jali] = useState(() =>
    createJali({
      panes: [note],
      layout: row(note({ id: 1 }), note({ id: 2 })),
      features: [
        ...defaultFeatures(),
        // On the server, the request's address; in the browser, the browser's.
        urlSync(typeof window === "undefined" ? { location: memoryLocation(search) } : {}),
      ],
      // The first render fits this size on both sides, so the HTML matches; <JaliRoot> then measures the real one.
      size: { width: 1280, height: 800 },
    }),
  );
  return <JaliRoot jali={jali} aria-label="Notes" />;
}
```

Then render that component from a page. Pass it the request's search, so the server renders the layout a link names:

`app/notes/page.tsx`

```tsx
// app/notes/page.tsx: a server component. It passes the request's search to the client component, so the server
// renders the layout the link names.
import { Panes } from "./panes";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of [value].flat()) if (v !== undefined) params.append(key, v);
  return (
    <main style={{ height: "100dvh" }}>
      <Panes search={params.size ? `?${params}` : ""} />
    </main>
  );
}
```

Import the styles from your root layout, after the stylesheet that names the layers:

```tsx filename="app/layout.tsx" nocheck
import "./globals.css"; // starts with @layer base, jali;
import "jali-layout/styles.css";
```

- **One instance per render tree.** `useState(() => createJali(...))` makes one per request on the server and one per page in the browser. A module-level instance in a client file would be shared by every request the server handles.
- **Leaving the route.** `<JaliRoot>` stops the instance's listeners when it unmounts. Don't call `jali.destroy()` in an effect's cleanup: in development, Strict Mode runs each cleanup once at mount, and a destroyed instance refuses every call after.

## Server rendering and hydration

Jali renders on the server with `renderToString` or a streaming renderer, and hydrates without a mismatch. The repo's `pnpm pack-check` does exactly that with the packed package. Three things make the server's HTML and the browser's first render agree:

1. **The same inputs on both sides:** the same kinds, layout or presets, and features.
2. **The same address.** On the server, give `urlSync()` the request's search with `memoryLocation(search)`. In the browser, `urlSync()` reads the real address, which holds the same search.
3. **The same size for the first render.** The server has no window, so pass `size`. Pass the same `size` in the browser; `<JaliRoot>` measures the real size after hydration and fits again.

On the server, storage is in memory, and the keys, Back and Forward, theme and saving don't start: `<JaliRoot>` starts them in the browser. A pane's own content renders on the server like any React component, so data it reads must be ready there too.

Other frameworks follow the same rules: React Router's framework mode, Remix and Astro's React islands all render a client component that makes the instance.

## TypeScript: register your instance

Declare your instance once, and the React hooks know its kinds and page:

```ts filename="src/jali.ts"
import { createJali } from "jali-layout";
import { definePane } from "jali-layout/react";

const order = definePane("order", { params: { id: Number }, title: ({ id }) => `Order ${id}`, Component: () => null });

export const jali = createJali({ panes: [order], layout: order({ id: 1 }) });

declare module "jali-layout" {
  interface Register {
    jali: typeof jali;
  }
}
```

Then `useJali().actions.openBeside` takes refs of your kinds only, and `jali.on("open", ({ ref }) => …)` narrows `ref.params` by `ref.kind`.

## Linked or in a monorepo

If your app gets Jali through `link:`, `file:` or `workspace:`, or from a symlinked checkout, two things can go wrong:

- **Two copies of React.** Jali finds its own copy of React beside its source, the app bundles two, and hooks fail with "Invalid hook call". With Vite, add `resolve: { dedupe: ["react", "react-dom"] }` to `vite.config.ts`. With webpack, alias `react` and `react-dom` to your app's copy.
- **A stale build.** A linked Jali resolves to its built files in `dist/`, which don't rebuild when its source changes. Rebuild it with `pnpm build:packages` in the Jali repo. Or read its source: with Vite, add the `"source"` condition, `resolve: { conditions: ["source", ...defaultClientConditions] }`. For Vitest, also add `ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } }`. Both defaults come from `vite`.

## Next

- [Quickstart](quickstart.md): Build the smallest app, step by step.

- [Features](../guides/your-app.md#choose-features): Choose what Jali does beyond laying out panes.

- [Troubleshooting](../guides/troubleshooting.md): Fixes for the problems people meet first.
