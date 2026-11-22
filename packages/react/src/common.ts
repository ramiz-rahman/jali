/** What `@jali/react` exports apart from `<JaliRoot>`. */

// ---------- start here ----------
export { JaliView } from "./JaliRoot";
export {
  definePane,
  definePage,
  type Pane,
  type PaneProps,
  type PaneOptionsReact,
  type MissingProps,
  type Page,
  type PageView,
} from "./define";

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

// ---------- the workspace in React ----------
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
export { CuratedPage, PageBar } from "./chrome/PageBar";
export { Shelf } from "./chrome/Shelf";
export { KindIcon } from "./pane/icons";
export { Activity } from "./pane/Activity";
export { IconButton, type IconButtonProps } from "./chrome/IconButton";

// ---------- icons ----------
export { useJaliIcons } from "./icons/context";
export type { JaliIcon, JaliIconName, JaliIconProps, JaliIcons } from "./icons/types";
