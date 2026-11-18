/**
 * @jali/core: a workspace of panes that fits the space it has. No framework: the layout tree and its operations, a
 * store with focus, undo and follow, keyboard commands, and ports for the address and for what a person keeps.
 * A framework adapter renders it (@jali/react).
 */

// ---------- the layout tree (pure: every operation returns a new layout) ----------
export type {
  Axis, Edge, Size, NodeId, ObjectRef, Layout, LayoutNode, PaneNode, SplitNode, StackNode, Overlay, ViewState,
  PaneKind, KindRegistry, LayoutContext, FitOptions, Rect, ResolvedLayout, PaneBox, DividerBox,
} from "./layout/types";
export * as layout from "./layout";
export { sameRef } from "./actions/follow";

// ---------- pane kinds and pages ----------
export { createPaneKinds, type PaneKindBase, type PaneKinds, type PaneCommand, type PaneActivity } from "./pane-kinds";
export {
  titleOf, roleOf, presetById, viewerLabel,
  type ProfileBase, type RoleBase, type ViewMode, type Preset, type Env,
} from "./profile";

// ---------- the workspace store ----------
export {
  createUiStore,
  type UiStore, type UiStoreDeps, type UiState, type PageState, type Selection, type WorkspaceDom, type UrlWriter,
} from "./state/store";
export type { Actions } from "./actions";
export type { WorkspaceModel } from "./state/model";
export type { Snapshot, Outcome, Toast, HistoryMode, Refusal } from "./state/apply";
export { DEFAULT_SETTINGS, resolveTheme, type Settings, type ThemeChoice, type Theme } from "./state/settings";
export { boot, startUi, type StartUiOptions } from "./boot";

// ---------- the address and what a person keeps ----------
export { createUrlSync, type UrlSync, type UrlSyncOptions, type UrlRead, type LinkSizes } from "./url";
export {
  browserLocation, memoryLocation, browserStorage, memoryStorage,
  type LocationPort, type StoragePort, type NavigateMode,
} from "./ports";

// ---------- commands and keys ----------
export { commandsOf, runCommand, shortcutLabel, copyLink, type Command } from "./commands/registry";
export {
  DEFAULT_KEYMAP, PALETTE_ID, createKeymap,
  type Keymap, type KeymapOverrides, type KeymapOptions, type DefaultKeymapId, type KeyString,
} from "./commands/keymap";
export { installKeyboard, type KeyboardScope } from "./commands/keyboard";
export { formatKeys, formatChord, keyHint, altClick, detectPlatform, type Platform } from "./commands/format";

// ---------- DOM ----------
export { focusPane } from "./dom/focus";
export { paneDomId, paneTitleId } from "./dom/ids";

// ---------- contracts with other libraries ----------
export type { ActiveItemPort, ActiveItemAction, ActiveItemWriteResult } from "./contracts/active-item";
export { activeItemPort, type ActiveItemMapping } from "./pane/activeItem";
