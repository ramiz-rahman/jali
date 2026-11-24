# Own icons

An app that gives Jali its own icon for every name. Like [`minimal`](../minimal), it exists for the checks, not as an
example app: `pnpm size` measures it, and `packages/react/src/bundle.test.ts` checks it ships no Phosphor.
`vp dev examples/own-icons` (or `pnpm own-icons`) serves it on :5311.

It takes each feature from its own entry (`jali-layout/url`, `jali-layout/palette`, `jali-layout/settings`, `jali-layout/chooser`,
`jali-layout/pressed`, `jali-layout/rename`), so every icon a feature draws is the app's. Its notes can be renamed (double-click a
tab, or F2), two of them share a tab strip, their headers keep only Maximise and Close (`buttons`), and each note's
text loads after it opens, with the kind's own `Loading` meanwhile.
