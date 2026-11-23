/**
 * @jali/core: panes that fit the space they have. No framework: pane kinds, layouts, the instance with
 * its actions, focus, undo and follow, keyboard commands, and ports for the address and for what a person keeps.
 * A framework adapter renders it (@jali/react). Adapters import "@jali/core/adapter", which has everything.
 */

// ---------- start here ----------
export { createJali, type JaliOptions, type PresetOptions } from "./create-jali";
export {
  row,
  column,
  tabs,
  pane,
  type LayoutInput,
  type Draft,
  type PaneDraft,
  type SplitDraft,
  type TabsDraft,
  type SizeOptions,
  type RowOptions,
  type PaneNodeOptions,
  type TabsOptions,
} from "./layout/build";

// ---------- pane kinds ----------
export type {
  PaneOptions,
  PaneWidth,
  PaneHeight,
  PaneDefinition,
  Ref,
  RefOf,
  PaneKindBase,
  PaneCommand,
  PaneActivity,
  PaneErrorInfo,
  Params,
  ParamValue,
  ParamType,
  ParamTypes,
  ParamsDeclaration,
  ParamsOf,
  OptionalParam,
  ParamOptions,
  AppOnlyParam,
  OneOf,
  ParamProblem,
  Identity,
  FollowParams,
} from "./pane-kinds";
export { optional, oneOf, appOnly } from "./pane-kinds";
export type { StandardSchemaV1 } from "./standard-schema";
export type { RoleBase, ProfileBase, ViewMode, ItemId } from "./profile";
export type { PhoneOptions } from "./env";

// ---------- the layout tree ----------
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
  TuckRecord,
} from "./layout/types";
export { sameRef } from "./actions/follow";

// ---------- the instance: actions, results, events ----------
export type {
  AnyJali,
  DeepReadonly,
  Jali,
  JaliEvent,
  JaliEventBase,
  JaliEvents,
  JaliState,
  PageOf,
  RefsOf,
  Register,
  RegisteredJali,
} from "./state/instance";
export type { JaliInput } from "./dom/input";
export type { Allow, AllowContext, AllowRule, PaneAllow, PaneControl } from "./actions/allow";
export type { PaneButton, PaneButtons, ButtonsContext } from "./pane/buttons";
export type {
  JaliActions,
  JaliDialogs,
  JaliPage,
  ActionName,
  PaneTarget,
  OpenPageOptions,
} from "./actions/public";
export type { OpenBesideOptions } from "./actions/open";
export type { ChooseOptions } from "./actions/choose";
export type {
  ActionResult,
  Refusal,
  RefusalReason,
  BeforeClose,
  CloseReason,
  CloseRequest,
  Done,
  Toast,
  HistoryMode,
} from "./state/apply";

// ---------- the instance's state ----------
export type { PageState, Selection, UrlState, UrlWriter } from "./state/store";
export type { Feature, FeatureId } from "./features/feature";
export type { JaliModel, PaneOf } from "./state/model";
export type { Settings, ThemeChoice, Theme } from "./state/settings";

// ---------- words (translations) ----------
export { en, type Messages, type MessageOverrides, type ScreenDirection } from "./state/messages";

// ---------- the address and what a person keeps ----------
export type { UrlSyncOptions, LinkSizes } from "./url";
export {
  memoryLocation,
  memoryStorage,
  type LocationPort,
  type StoragePort,
  type NavigateMode,
} from "./ports";

// ---------- commands and keys ----------
export {
  runCommand,
  copyLink,
  listCommands,
  type Command,
  type ListedCommand,
} from "./commands/registry";
export type { TabMenu, TabMenuItem } from "./commands/tab-menu";
export type { Rename } from "./actions/rename";
export {
  type Keymap,
  type KeymapOverrides,
  type KeymapOptions,
  type KeyboardOptions,
  type DefaultKeymapId,
  type KeyString,
} from "./commands/keymap";
/** For an app's own window-level keys: whether a key belongs to the focused content (a field, a button, a dialog). */
export { keyBelongsToContent } from "./commands/content-keys";
export {
  keyHint,
  altClick,
  type Platform,
  type KeyWords,
  type Chord,
  type KeySequence,
} from "./commands/format";

// ---------- geometry ----------
/** Scroll a row that scrolls sideways while a drag is held near its edge, for an app's own drag (Jali's does it). */
export { edgeScroll, type EdgeScroll } from "./workspace/edge-scroll";
