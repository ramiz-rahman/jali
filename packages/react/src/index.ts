/**
 * @jali/react: React components and hooks for a Jali workspace, with Phosphor's icons (`@jali/react/bare` has none:
 * the host passes every icon; `@jali/react/icons` exports Phosphor's set). Styles: "@jali/react/styles.css" (Jali's default
 * theme and the workspace, in the `jali` cascade layer); "@jali/react/tailwind.css" to take the app's Tailwind theme.
 */

export * from "./common";
export { JaliRoot, JaliProvider, type JaliRootProps } from "./withPhosphor";
