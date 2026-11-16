# Decisions and deviations

Append-only. Each entry: date · who · what · why.

2026-11-17 · WP2 · Added the missing PostgreSQL products price-audit trigger to the sample SQL. The PostgreSQL variant previously created no trigger, so PGlite could not demonstrate the audit side effect.

- 2026-11-17 · WP3 (UI) · PaneKind React interface in `src/ui/pane-kinds.ts`: `registerPaneKind({ kind, title, minWidth, minHeight, maxWidth?, preferredWidth?, heavy?, icon?, Component })`. Component props are `{ node, ref, paused, focused, openBeside, peek, select }` as asked, plus `setActivity`, `inPeek` and `holding`. `ref` is the ObjectRef (React 19 passes `ref` to function components as a plain prop). `useDataLayer()` and `<DataLayerProvider>` live in the same file so pane kinds have one import. `kindRegistry()` derives the framework-free `KindRegistry` for layout-core. `src/panes/index.ts` is loaded before first render if it exists.
