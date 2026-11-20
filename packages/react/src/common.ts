/** What `@jali/react` exports apart from `<JaliRoot>` and `<JaliProvider>`. */

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
export { useJali, useJaliState, useJaliModel, useTheme } from "./state/react";
export { useShortcut, useJaliCommands } from "./commands/react";
export { keyBelongsToContent } from "./keys";

// ---------- parts, to compose your own (<JaliRoot> and <JaliView> render these) ----------
export { Panes } from "./workspace/Workspace";
export { CuratedPage, PageBar } from "./chrome/PageBar";
export { Shelf } from "./chrome/Shelf";
export { Announcer } from "./chrome/Announcer";
export { Palette } from "./dialogs/Palette";
export { SettingsPanel } from "./dialogs/Settings";
export { Chooser } from "./dialogs/Chooser";
export { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
export { KindIcon } from "./pane/icons";
export { Activity } from "./pane/Activity";
export { IconButton, type IconButtonProps } from "./chrome/IconButton";

// ---------- icons ----------
export { useJaliIcons } from "./icons/context";
export type { JaliIcon, JaliIconName, JaliIconProps, JaliIcons } from "./icons/types";
