/**
 * @jali/react: React components and hooks for a Jali workspace. Styles: "@jali/react/styles.css" (Jali's default
 * theme and the workspace, in the `jali` cascade layer); "@jali/react/tailwind.css" to take the app's Tailwind theme.
 */

// ---------- start here ----------
export { Jali, JaliView, type JaliProps } from "./Jali";

// ---------- defining panes and pages ----------
export { definePaneKind, type PaneKindDef, type PaneComponentProps, type RoleDef, type WorkspaceProfile, type ReactEnv } from "./define";

// ---------- inside a pane ----------
export { usePaneState, PaneIdContext } from "./pane/usePaneState";
export { useActiveItemPort } from "./pane/useActiveItemPort";

// ---------- the store in React ----------
export {
  StoreProvider, useStore, useUi, useModel, useActions, useEnv, useProfile, useTitleOf, type ReactUiStore,
} from "./state/react";
export { useShortcut, useShortcutSuffix } from "./commands/react";

// ---------- parts, to compose your own (<Jali> and <JaliView> render these) ----------
export { Workspace } from "./workspace/Workspace";
export { CuratedPage, PageBar } from "./chrome/PageBar";
export { Shelf } from "./chrome/Shelf";
export { Announcer } from "./chrome/Announcer";
export { Palette } from "./dialogs/Palette";
export { SettingsPanel } from "./dialogs/Settings";
export { Chooser } from "./dialogs/Chooser";
export { ConfirmDiscard } from "./dialogs/ConfirmDiscard";
export { KindIcon } from "./pane/icons";
export { Activity } from "./pane/Activity";
