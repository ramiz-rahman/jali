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
  PaneErrorInfo,
  Params,
  ParamValue,
  ParamType,
  ParamTypes,
  ParamsOf,
  OptionalParam,
  OneOf,
  ParamProblem,
} from "./pane-kinds";
export { optional, oneOf } from "./pane-kinds";
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
} from "./layout/types";
export * as layout from "./layout";
export { sameRef } from "./actions/follow";

// ---------- the instance: actions, results, events ----------
export type { JaliEvents, JaliState } from "./state/instance";
export type { JaliActions, PaneTarget, OpenPageOptions } from "./actions/public";
export type {
  ActionResult,
  Refusal,
  RefusalReason,
  BeforeClose,
  CloseRequest,
  Toast,
  HistoryMode,
} from "./state/apply";

// ---------- the workspace's state ----------
export type { PageState, Selection, UrlWriter } from "./state/store";
export type { JaliModel, Group } from "./state/model";
export type { Settings, ThemeChoice, Theme } from "./state/settings";

// ---------- words (translations) ----------
export { en, type Messages, type MessageOverrides, type ScreenDirection } from "./state/messages";

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
  type KeyWords,
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
