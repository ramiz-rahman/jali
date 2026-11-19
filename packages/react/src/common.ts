/**
 * What `@jali/react` and `@jali/react/bare` both export: everything but `<JaliRoot>` and `<JaliProvider>`, which each
 * entry gives its own icons. Nothing here imports Phosphor.
 */

// ---------- start here ----------
export { JaliView } from "./JaliRoot";
export {
  definePane,
  definePage,
  type Pane,
  type PaneProps,
  type PaneOptionsReact,
  type Page,
  type PageView,
} from "./define";

// ---------- inside a pane ----------
export {
  usePane,
  useActivity,
  useUnsaved,
  useCommands,
  useLauncher,
  type LauncherSources,
} from "./pane/hooks";
export { usePaneState } from "./pane/usePaneState";
export { useActiveItemPort } from "./pane/useActiveItemPort";

// ---------- the workspace in React ----------
export { useJali, useJaliState, useJaliModel, useTheme } from "./state/react";
export { useShortcut, useJaliCommands } from "./commands/react";

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

// ---------- icons ----------
export { useJaliIcons } from "./icons/context";
export type { JaliIcon, JaliIconName, JaliIconProps, JaliIcons } from "./icons/types";
