/**
 * For live parts made outside src/live (the landing's demos, src/landing/demos): the shop and the pieces that embed a
 * workspace in a page, without the figures. Pages use ./index.ts; this is for code that builds a part of its own.
 */
export { shopKinds } from "./shop/kinds";
export { buildDemoLayout, demoLayouts, type DemoLayoutId } from "./shop/layouts";
export { embedded, useEmbeddedId } from "./workspace/embedded";
export { NamedWorkspace } from "./workspace/LiveWorkspace";
export { useHydrated } from "./workspace/ClientOnly";
