/**
 * What the published `jali` package (packages/jali) re-exports from this workspace package, beyond its index: each
 * feature with its parts, `defaultFeatures`, and the pieces `jali/react` lists one by one. Not for apps.
 */
export * from "./index";
export { definePage, type Page, type PageView } from "./define";
export { defaultIcons } from "./icons/default";
export { chooser, palette, settings } from "./features/dialogs";
export { rename } from "./features/rename";
export { popOut } from "./features/pop-out";
export { pressed } from "./features/pressed";
export { defaultFeatures } from "./features/defaults";
