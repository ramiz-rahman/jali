/**
 * @jali/react: React components and hooks for a Jali workspace. Styles: "@jali/react/styles.css" (Jali's default
 * theme and the workspace, in the `jali` cascade layer); "@jali/react/tailwind.css" to take the app's Tailwind theme.
 */

// ---------- start here ----------
export { JaliRoot, JaliView, type JaliRootProps } from "./JaliRoot";
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
export { JaliProvider, useJali, useJaliState, useJaliModel, useTheme } from "./state/react";
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
