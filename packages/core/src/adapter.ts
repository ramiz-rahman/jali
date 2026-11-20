/**
 * @jali/core/adapter: what a framework adapter (@jali/react is one) needs beyond the public API. Apps import
 * "@jali/core". Everything in "@jali/core" is here too; the rest is listed by name, so nothing inside the core
 * becomes part of this entry by accident. Names here that are not in "@jali/core" can change in any minor version.
 */
export * from "./index";

// ---------- the layout tree's types ----------
export type {
  HideRefusal,
  HideResult,
  OpenResult,
  PutBackResult,
  TuckCheck,
  TuckRecord,
  TuckRefusal,
  TuckResult,
  UndoEntry,
} from "./layout/types";

// ---------- the instance and start-up ----------
export { createInstance, storeOf, type JaliEvent } from "./state/instance";
export { boot, flushPaneState, startUi, type StartOptions } from "./boot";

// ---------- the store, its state and its changes ----------
export {
  createUiStore,
  type ChooserState,
  type ConfirmState,
  type DndState,
  type JaliDom,
  type UiState,
  type UiStore,
  type UiStoreDeps,
} from "./state/store";
export {
  DONE,
  POLICY,
  apply,
  geometryOf,
  isRefusal,
  leavingPanes,
  refuse,
  wouldLoseWork,
  type Agreed,
  type AnswerStep,
  type ApplyIO,
  type Asked,
  type Change,
  type CloseReason,
  type Deferred,
  type Done,
  type Geometry,
  type Intent,
  type Op,
  type Outcome,
  type RefusalStep,
  type Snapshot,
} from "./state/apply";
export { buildModel, modelCache, type ModelInput } from "./state/model";
export { UNDO_MAX, forgetTuck, pruneUndo, pushUndo, tuckOrder } from "./state/undo";
export {
  DEFAULT_SETTINGS,
  PANE_CAP_MAX,
  applyTheme,
  loadSettings,
  resolveTheme,
  saveSettings,
  settingsWith,
  systemPrefersDark,
  watchSystemTheme,
} from "./state/settings";
export { baseEn, dirWord, dropText, messagesOf, resolveMessages, say } from "./state/messages";
export {
  loadPaneState,
  loadPaneStateOwners,
  objectKey,
  ownedPaneState,
  ownedSelection,
  paneStateFor,
  savePaneState,
  selectionFor,
  type PaneOwners,
  type PaneStates,
} from "./state/pane-state";
export { loadPrefs, savePrefs, type PagePrefs } from "./state/page-prefs";

// ---------- actions: the engine's steps, and what the chrome asks of them ----------
export {
  ACTIONS,
  bindActions,
  mergeReports,
  pageStep,
  type Actions,
  type PageSteps,
  type PaneReport,
  type PaneReportPatch,
} from "./actions";
export { PANE_CONTROLS, allows, dividerAllowed, notAllowed } from "./actions/allow";
export { openPaneFor } from "./actions/open";
export { publicActions, paneFor } from "./actions/public";
export { restoreLayout, arrive } from "./actions/layout";
export { mergeTargets, type MergeTarget } from "./actions/tabs";
export { checkTuck, tuckHome } from "./actions/tuck";
export { canRename } from "./actions/rename";
export { besidePreview, investigation, viewerLabel, pageEngine } from "./actions/page";

// ---------- pane kinds, profiles and pane chrome ----------
export {
  ACTIVITY_URGENCY,
  DEFAULT_MIN_HEIGHT,
  DEFAULT_MIN_WIDTH,
  appOnlyParams,
  checkRef,
  createPaneKinds,
  defineKind,
  describeProblems,
  linkLayout,
  linkRef,
  readLayout,
  readRef,
  keepOwnParams,
  unlinkedParams,
  linkView,
  mostPressing,
  parseParams,
  readParams,
  type PaneAttributes,
} from "./pane-kinds";
export {
  PAGE,
  PHONE_BELOW,
  asItem,
  pageEngineOf,
  presetById,
  roleOf,
  shownTitle,
  titleOf,
  type BesidePreview,
  type OpenPage,
  type PageEngine,
} from "./profile";
export { ALONE_CHROME, CHROME, type Chrome, type Presentation } from "./pane/chrome";
export { DEFAULT_BUTTONS, buttonsOf, type ButtonsState } from "./pane/buttons";

// ---------- layouts as data ----------
export type { Draft, PaneDraft, SplitDraft, TabsDraft } from "./layout/build";

// ---------- commands and keys ----------
export {
  commandById,
  commandDefsOf,
  revealFromShelf,
  setPopOutPort,
  shortcutLabel,
  type CommandDef,
  type PopOutPort,
} from "./commands/registry";
export { DEFAULT_PREFIX, PALETTE_ID, createKeymap } from "./commands/keymap";
export {
  createKeyHandler,
  installKeyboard,
  type KeyHandler,
  type KeyboardScope,
} from "./commands/keyboard";
export {
  SERVER_PLATFORM,
  detectPlatform,
  formatChord,
  isCharacterKey,
  isEditable,
  isMac,
  isModifierKey,
  matchChord,
  parseChord,
  parseKeys,
} from "./commands/format";
export { cycleRegions } from "./commands/regions";
export { tabMenuOf } from "./commands/tab-menu";

// ---------- the DOM: the adapter's port, focus, ids, input, direction and size ----------
export { noDom, type DividerLine, type DomPort, type DragKind } from "./dom/port";
export {
  activeTabId,
  flashTab,
  focusInShelf,
  focusPane,
  focusShelf,
  focusShelfChip,
  keepPaneFocus,
  shownShelf,
} from "./dom/focus";
export { cssString, paneDomId, paneTitleId } from "./dom/ids";
export { currentInput, trackInput, withInput } from "./dom/input";
export {
  directionOf,
  forwardArrow,
  inlineStep,
  pageDirection,
  readDirection,
  scrolledFromStart,
  watchDirection,
} from "./dom/direction";
export { observeResize } from "./dom/resize";

// ---------- drags, dividers and the workspace's geometry ----------
export { isDividerDragging, startDividerDrag } from "./dividers/drag";
export {
  SNAP_IN,
  SNAP_OUT,
  STEP,
  STEP_BIG,
  clampSize,
  dividerKey,
  geometryFor,
  nearestDivider,
  snap,
  type PairGeometry,
} from "./dividers/resize";
export {
  DRAG_THRESHOLD,
  EDGE_ZONE,
  startPaneDrag,
  startTabDrag,
  tabDropAt,
  zoneFor,
  zoneRect,
  type PointerStart,
  type TabDrop,
} from "./workspace/dnd";
export {
  STACK_GAP,
  stackGap,
  currentPane,
  frames,
  sameFrame,
  sameNode,
  type Frame,
  type Tab,
} from "./workspace/frames";
export { restoreWide, snapshotWide, type WideSnapshot } from "./workspace/single-view";
export {
  STACK_FLOOR,
  STACK_MIN_HEIGHT,
  foldPair,
  hingeOf,
  sameHinge,
  stackPair,
  stackShare,
  type Hinge,
  type StackPair,
} from "./workspace/stack";
export {
  SWITCHER_H,
  applyTokens,
  initialArea,
  spacingOf,
  spacingVars,
  type Spacing,
} from "./tokens";

// ---------- the address and what a person keeps ----------
export {
  OPEN_MAX,
  PERSIST_MS,
  buildSearch,
  createUrlSync,
  decodePeek,
  encodePeek,
  joinPersonalSizes,
  readSearch,
  splitPersonalSizes,
  structureKey,
  urlKeys,
  type PageRead,
  type PersonalSizes,
  type UrlKeys,
  type UrlRead,
  type UrlSync,
} from "./url";

// ---------- small helpers ----------
export { own } from "./own";
