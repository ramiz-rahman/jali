# Fixtures

Small apps that are not examples: they exist for the docs and the checks.

- `minimal/`: the smallest Jali app, on the public API alone. The quickstart builds it, `pnpm size` measures it, and `packages/react/src/bundle.test.ts` checks it bundles Jali's icons. `vp dev fixtures/minimal` serves it on :5310.
- `own-icons/`: an app that gives Jali its own icon for every name. `pnpm size` measures it, and the bundle test checks it ships no Phosphor. `vp dev fixtures/own-icons` serves it on :5311.

The example apps are in [`examples/`](../examples).
