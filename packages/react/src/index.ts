/**
 * @jali/react's public surface: what `jali/react` re-exports (packages/jali/src/react.ts lists it name by name).
 * Components and hooks for a Jali instance, with Jali's own icons (`<JaliRoot icons>` replaces any). Styles come from
 * `jali/styles.css`. internal.ts adds what the published package needs beyond this (the features).
 */

// ---------- start here ----------
export { JaliRoot, JaliView, type JaliRootProps } from "./JaliRoot";
export {
  definePane,
  type Pane,
  type PaneProps,
  type PaneOptionsReact,
  type PaneKindDef,
  type MissingProps,
  type Page,
  type PageView,
} from "./define";
export { definePage } from "./page/define";

// ---------- inside a pane ----------
export {
  usePane,
  useActivity,
  useUnsaved,
  useCommands,
  useTitle,
  usePaneAttributes,
  useHeaderActions,
  useLauncher,
  type LauncherSources,
} from "./pane/hooks";
// Declaring a kind's params: `params: { id: Number, tab: optional(String), autorun: appOnly(Boolean) }` (from @jali/core).
export { optional, oneOf, appOnly } from "@jali/core/adapter";
export { usePaneState, type PaneStateOptions } from "./pane/usePaneState";
export { useActiveItemPort } from "./pane/useActiveItemPort";

// ---------- the instance in React ----------
export {
  useJali,
  useJaliState,
  useJaliModel,
  useJaliEvent,
  useJaliTheme,
  shallow,
} from "./state/react";
export { useJaliShortcut, useJaliCommands } from "./commands/react";
// Framework-free, from @jali/core, here too for an app's own keys.
export { keyBelongsToContent } from "@jali/core/adapter";

// ---------- chrome of your own, inside <JaliRoot> around <JaliView /> ----------
// The dialogs, the live region and the panes themselves are the root's: every way of using Jali gets them.
export { CuratedPage } from "./page/CuratedPage";
export { PageBar } from "./page/PageBar";
export { Shelf } from "./chrome/Shelf";
export { KindIcon } from "./pane/icons";
export { Activity } from "./pane/Activity";
export { IconButton, type IconButtonProps } from "./chrome/IconButton";

// ---------- icons ----------
export { useJaliIcons } from "./icons/context";
export type { JaliIcon, JaliIconName, JaliIconProps, JaliIcons } from "./icons/types";
