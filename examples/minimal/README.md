# Minimal

The smallest Jali app, on the public API alone. It is not one of the five example apps held to
[docs/EXAMPLES-STANDARD.md](../../docs/EXAMPLES-STANDARD.md): it exists for the docs and the checks. The quickstart builds
it, `pnpm size` measures it, and `packages/react/src/bundle.test.ts` checks it bundles Jali's icons.
`vp dev examples/minimal` (or `pnpm minimal`) serves it on :5310.

[`own-icons`](../own-icons) is its sibling: the same kind of app, with its own icon for every name.
