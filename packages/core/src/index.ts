/**
 * @jali/core: a workspace of panes that fits the space it has. No framework: pane kinds, layouts, the workspace with
 * its actions, focus, undo and follow, keyboard commands, and ports for the address and for what a person keeps.
 * A framework adapter renders it (@jali/react). Adapters import "@jali/core/adapter", which has everything.
 */

// ---------- start here ----------
export { createJali, type Jali, type JaliOptions, type PresetOptions } from "./create-jali";
export {
  row,
  column,
  tabs,
  pane,
  toLayout,
  type LayoutInput,
  type SizeOptions,
  type PaneNodeOptions,
  type TabsOptions,
} from "./layout/build";

// ---------- pane kinds ----------
export type {
  PaneOptions,
  PaneWidth,
  PaneHeight,
  PaneDefinition,
  PaneKindBase,
  PaneKinds,
  PaneCommand,
  PaneActivity,
  Params,
  ParamValue,
  ParamType,
  ParamTypes,
  ParamsOf,
} from "./pane-kinds";
export type { RoleBase, ProfileBase, ViewMode, Preset, Env, ItemId } from "./profile";

// ---------- the layout tree (pure: every operation returns a new layout) ----------
export type {
  Axis,
  Direction,
  Edge,
  Size,
  NodeId,
  ObjectRef,
  Layout,
  LayoutNode,
  PaneNode,
  SplitNode,
  StackNode,
  Overlay,
  ViewState,
  Rect,
  ResolvedLayout,
  ResolvedStack,
  PaneBox,
  DividerBox,
  PaneKind,
  KindRegistry,
  LayoutContext,
  FitOptions,
  ShelfEntry,
  UndoEntry,
} from "./layout/types";
export * as layout from "./layout";
export { sameRef } from "./actions/follow";

// ---------- the workspace's state ----------
export type {
  UiState as JaliState,
  PageState,
  Selection,
  JaliDom,
  UrlWriter,
  DndState,
  ConfirmState,
  ChooserState,
} from "./state/store";
export type { Actions } from "./actions";
export type { OpenPage } from "./actions/page";
export type { PagePrefs } from "./state/page-prefs";
export type { JaliModel, Group } from "./state/model";
export type { Snapshot, Outcome, Change, Refusal, Toast, HistoryMode } from "./state/apply";
export type { Settings, ThemeChoice, Theme } from "./state/settings";

// ---------- the address and what a person keeps ----------
export type { UrlSyncOptions, LinkSizes } from "./url";
export {
  browserLocation,
  memoryLocation,
  browserStorage,
  memoryStorage,
  type LocationPort,
  type StoragePort,
  type NavigateMode,
} from "./ports";

// ---------- commands and keys ----------
export {
  commandsOf,
  runCommand,
  copyLink,
  listCommands,
  type Command,
  type ListedCommand,
} from "./commands/registry";
export {
  DEFAULT_KEYMAP,
  type Keymap,
  type KeymapOverrides,
  type KeymapOptions,
  type DefaultKeymapId,
  type KeyString,
} from "./commands/keymap";
export {
  keyHint,
  formatKeys,
  type Platform,
  type Chord,
  type KeySequence,
} from "./commands/format";

// ---------- geometry ----------
/** The gap between panes and the workspace's inset, in px: for a host that measures around a workspace. */
export { GAP } from "./tokens";

// ---------- contracts with other libraries ----------
export type {
  ActiveItemPort,
  ActiveItemAction,
  ActiveItemWriteResult,
} from "./contracts/active-item";
export { activeItemPort, type ActiveItemMapping } from "./pane/activeItem";
