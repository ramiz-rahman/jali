/**
 * One command registry (spec §0.2): every instance command has a stable id, a title, a check and a run. Keys are
 * not here: the store's keymap (commands/keymap.ts) binds ids to keys, so a host can rebind or unbind any of them.
 * The palette lists every command (disabled while the check refuses) with its keys; the keyboard runs the command a
 * binding names (and says a refusal's reason); tooltips print `store.keymap.label(id)`.
 */
import { checkAutoLayout } from "../actions/layout";
import { notAllowed, type PaneControl } from "../actions/allow";
import type { Edge } from "../layout/types";
import { checkCloseOthers, checkUndo } from "../actions/close";
import { changeSettings } from "../actions/layout";
import { checkFullScreen, checkZoom } from "../actions/focus";
import { checkSplit } from "../actions/open";
import { checkPeek } from "../actions/peek";
import { checkPutBack, checkTuck } from "../actions/tuck";
import { checkMerge, checkMoveTab, checkUnmerge } from "../actions/tabs";
import { checkRename } from "../actions/rename";
import { serviceOf, type FeatureId } from "../features/feature";
import { activeTabId, focusShelfChip } from "../dom/focus";
import type { Env } from "../env";
import {
  isChange,
  refuse,
  type ActionResult,
  type RefusalStep,
  type Snapshot,
} from "../state/apply";
import { messagesOf, type ScreenDirection } from "../state/messages";
import type { JaliStore } from "../state/store";
import { storeOf, type AnyJali, type Jali } from "../state/instance";
import { cycleRegions } from "./regions";
import { own as ownOf } from "../own";

/** A command: one of Jali's (`commandsOf`), or the app's own (`createJali({ commands })`). */
export interface Command {
  id: string;
  title: string;
  /** Jali's groups, or a host command's own. */
  group: "Focus" | "Pane" | "Move" | "Tabs" | "Layout" | "Peek" | "Settings" | (string & {});
  run: (jali: Jali) => void;
}

/** A command as the registry holds it (adapters): with its check, run on the store. */
export interface CommandDef extends Omit<Command, "run"> {
  /** Why the command can't run now (silent without a message); undefined when it can. `store` is the instance the
   *  snapshot is of: a check that asks the instance's adapter (Pop out) needs it, and can't run without it. */
  check?: (x: Snapshot, store?: JaliStore) => RefusalStep | undefined;
  /** Run it. A command that runs an action returns its result, so `runCommand` can say whether it ran. */
  run: (store: JaliStore) => ActionResult | void;
}

/** `check`, then the app's `allow` for the focused pane (a command for something it doesn't allow is greyed out,
 *  saying why). Leaving maximise or full screen is always allowed. */
const also =
  (check: (x: Snapshot, store?: JaliStore) => RefusalStep | undefined, control: PaneControl) =>
  (x: Snapshot, store?: JaliStore): RefusalStep | undefined => {
    const id = x.s.view.focused;
    const leaving =
      (control === "maximise" && x.s.view.zoomed === id) ||
      (control === "fullScreen" && x.s.fullScreen === id);
    return check(x, store) ?? (leaving ? undefined : notAllowed(x, id, control));
  };
const needFocus = ({ s }: Snapshot) => (s.view.focused ? undefined : refuse("unavailable"));
const needLauncher = (x: Snapshot) =>
  x.s.view.focused && x.env.launcher ? undefined : refuse("unavailable");
const inStrip = (x: Snapshot) =>
  needFocus(x) ??
  (x.m.resolved.scrollers.some((r) => r.paneIds.includes(x.s.view.focused!))
    ? undefined
    : refuse("unavailable"));
const needOthers = (x: Snapshot) =>
  needFocus(x) ?? (x.m.panes.length > 1 ? undefined : refuse("unavailable"));
const DIRS: [Edge, ScreenDirection][] = [
  ["left", "left"],
  ["right", "right"],
  ["top", "up"],
  ["bottom", "down"],
];

/** Every command an instance has: the fixed set, its presets', its features' (each only with its feature, in its
 *  words) and the host's, with titles in its own words (its name, its viewers). */
function buildCommands(env: Env): CommandDef[] {
  const { commands: t, commandGroups: g } = messagesOf(env);
  const has = (id: FeatureId) => !!env.features?.some((f) => f.id === id);
  const popOut = serviceOf(env, "popOutWindow");
  return [
    // F6 visits the panes, then the shelf and the host's regions (commands/regions.ts).
    {
      id: "pane.focus.next",
      title: t.focusNext,
      group: g.focus,
      run: (u) => cycleRegions(u, false),
    },
    {
      id: "pane.focus.previous",
      title: t.focusPrevious,
      group: g.focus,
      run: (u) => cycleRegions(u, true),
    },
    ...DIRS.map(([d, w]): CommandDef => ({
      id: `pane.focus.${w}`,
      title: t.focusDirection(w),
      group: g.focus,
      check: needFocus,
      run: (u) => u.actions.focusDirection(d),
    })),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): CommandDef => ({
      id: `pane.focus.${n}`,
      title: t.focusIndex(n),
      group: g.focus,
      run: (u) => u.actions.focusIndex(n),
    })),

    {
      id: "pane.zoom",
      title: t.zoom,
      group: g.pane,
      check: (x) => checkZoom(x),
      run: (u) => u.actions.toggleZoom(),
    },
    {
      id: "pane.fullscreen",
      title: t.fullScreen,
      group: g.pane,
      check: (x) => checkFullScreen(x),
      run: (u) => u.actions.toggleFullScreen(),
    },
    // With `popOut()`: the pane menu's Pop out, from ⌘K or a key, through the feature's window.
    ...(popOut
      ? [
          {
            id: "pane.pop_out",
            title: t.popOut,
            group: g.pane,
            check: also(
              (x) => needFocus(x) ?? (popOut.can() ? undefined : refuse("unavailable")),
              "popOut",
            ),
            run: (u: JaliStore) => {
              const id = u.get().view.focused;
              if (id) void popOut.open(u, id);
            },
          },
        ]
      : []),
    {
      id: "pane.tuck",
      title: t.tuck,
      group: g.pane,
      check: (x) => checkTuck(x),
      run: (u) => u.actions.tuck(),
    },
    // A tucked tab with DOM focus is the one put back first.
    {
      id: "pane.putBack",
      title: t.putBack,
      group: g.pane,
      check: checkPutBack,
      run: (u) => u.actions.putBack(undefined, activeTabId(u.dom)),
    },
    {
      id: "shelf.reveal",
      title: t.revealFromShelf,
      group: g.pane,
      check: (x) => (x.m.resolved.shelf.length ? undefined : refuse("unavailable")),
      run: revealFromShelf,
    },
    {
      id: "pane.resize_mode",
      title: t.resizeMode,
      group: g.pane,
      check: needFocus,
      run: (u) => u.actions.enterResizeMode(),
    },
    {
      id: "pane.close",
      title: t.close,
      group: g.pane,
      check: also(needOthers, "close"),
      run: (u) => u.actions.close(),
    },
    {
      id: "pane.close_others",
      title: t.closeOthers,
      group: g.pane,
      check: (x) => needFocus(x) ?? checkCloseOthers(x),
      run: (u) => u.actions.closeOthers(),
    },
    {
      id: "pane.undo_close",
      title: t.undoClose,
      group: g.pane,
      check: checkUndo,
      run: (u) => u.actions.undo(),
    },
    // Splits open a launcher (a "New pane" to choose an object in), never a copy of the focused object.
    {
      id: "pane.split.right",
      title: t.splitRight,
      group: g.pane,
      check: (x) => checkSplit(x),
      run: (u) => u.actions.split(undefined, "right"),
    },
    {
      id: "pane.split.down",
      title: t.splitDown,
      group: g.pane,
      check: (x) => checkSplit(x),
      run: (u) => u.actions.split(undefined, "bottom"),
    },
    {
      id: "pane.split.auto",
      title: t.splitAuto,
      group: g.pane,
      check: (x) => checkSplit(x),
      run: (u) => u.actions.splitAuto(),
    },

    ...DIRS.map(([d, w]): CommandDef => ({
      id: `pane.move.${w}`,
      title: t.moveDirection(w),
      group: g.move,
      check: also(needOthers, "move"),
      run: (u) => u.actions.moveDirection(d),
    })),
    // Out of a row that scrolls sideways, beside it: without dragging, and from the middle of the row in one step.
    {
      id: "pane.move.out",
      title: t.moveOutOfRow,
      group: g.move,
      check: also(inStrip, "move"),
      run: (u) => u.actions.moveOutOfRow(),
    },
    {
      id: "pane.swap",
      title: t.swap,
      group: g.move,
      check: also(needOthers, "move"),
      run: (u) => u.actions.swapWithNext(),
    },

    // Merge (with the chooser, `chooser()`) and unmerge without dragging (WCAG 2.5.7).
    ...(has("chooser")
      ? [
          {
            id: "pane.merge",
            title: t.merge,
            group: g.tabs,
            check: also(checkMerge, "move"),
            run: (u: JaliStore) =>
              u.set({ chooser: { kind: "merge", source: u.get().view.focused! } }),
          },
        ]
      : []),
    {
      id: "pane.unmerge",
      title: t.unmerge,
      group: g.tabs,
      check: also(checkUnmerge, "move"),
      run: (u) => u.actions.unmerge(),
    },
    ...(["left", "right"] as const).map((side) => ({
      id: `tab.move.${side}`,
      title: t.moveTab(side),
      group: g.tabs,
      check: also(checkMoveTab, "move"),
      run: (u: JaliStore) => u.actions.moveTabToward(side),
    })),
    ...(has("rename")
      ? [
          {
            id: "pane.rename",
            title: t.rename,
            group: g.pane,
            check: checkRename,
            run: (u: JaliStore) => u.actions.startRename(),
          },
        ]
      : []),
    {
      id: "stack.new-tab",
      title: t.newTab,
      group: g.tabs,
      check: needLauncher,
      run: (u) => u.actions.newTab(),
    },

    ...env.presets.map((p): CommandDef => ({
      id: `layout.preset.${p.id}`,
      title: t.preset(p.label),
      group: g.layout,
      run: (u) => u.actions.preset(p.id),
    })),
    {
      id: "layout.reset",
      title: t.resetLayout,
      group: g.layout,
      check: () => (env.presets.length ? undefined : refuse("unavailable")),
      run: (u) => u.actions.resetLayout(),
    },
    {
      id: "layout.auto",
      title: t.autoLayout,
      group: g.layout,
      check: checkAutoLayout,
      run: (u) => u.actions.autoLayout(),
    },
    { id: "layout.copy_link", title: t.copyLink, group: g.layout, run: (u) => copyLink(u.jali) },
    // A curated page's own commands, from its engine (actions/page.ts): only an instance with a page has them.
    ...(env.page?.commands(env) ?? []),

    {
      id: "peek.close",
      title: t.peekClose,
      group: g.peek,
      check: checkPeek,
      run: (u) => u.actions.closePeek(),
    },
    {
      id: "peek.open_beside",
      title: t.peekOpenBeside,
      group: g.peek,
      check: checkPeek,
      run: (u) => u.actions.openPeekBeside(),
    },

    ...(has("settings")
      ? [
          {
            id: "settings.open",
            title: t.settingsOpen,
            group: g.settings,
            run: (u: JaliStore) => u.run("dialogs.openSettings"),
          },
        ]
      : []),
    {
      id: "settings.centre_drop.toggle",
      title: t.centreDropToggle,
      group: g.settings,
      run: toggleCentreDrop,
    },

    // The host's own, last (a Jali id wins if a host repeats one).
    ...(env.commands ?? []).map((c): CommandDef => ({
      id: c.id,
      title: c.title,
      group: c.group,
      run: (u) => c.run(u.jali),
    })),
  ];
}

interface Built {
  defs: CommandDef[];
  byId: Map<string, CommandDef>;
  commands: Command[];
}
const built = /* @__PURE__ */ new WeakMap<Env, Built>();
const forEnv = (env: Env) => {
  let b = built.get(env);
  if (!b) {
    const all = buildCommands(env);
    const byId = new Map<string, CommandDef>();
    for (const c of all) if (!byId.has(c.id)) byId.set(c.id, c);
    const defs = all.filter((c) => byId.get(c.id) === c);
    const commands = defs.map((c): Command => ({
      id: c.id,
      title: c.title,
      group: c.group,
      run: (jali) => void run(storeOf(jali), c.id),
    }));
    b = { defs, byId, commands };
    built.set(env, b);
  }
  return b;
};

/** The instance's commands, in palette order. Same array per instance. */
export const commandsOf = (jali: Pick<AnyJali, "env">): readonly Command[] =>
  forEnv(jali.env).commands;

/** The registry's commands, with their checks (adapters). */
export const commandDefsOf = (store: Pick<JaliStore, "env">): readonly CommandDef[] =>
  forEnv(store.env).defs;

/** Whether a command's result means it ran: done, or held for an answer (the host's `beforeClose`, or "Discard
 *  unsaved changes?"). A command that isn't an action (it opens a dialog) ran if its check passed. */
const ran = (r: ActionResult | void) =>
  !r || r.ok || r.reason === "pending" || r.reason === "unsaved";

function run(store: JaliStore, id: string): boolean {
  const c = forEnv(store.env).byId.get(id);
  if (!c || store.ended() || c.check?.(store.snapshot(), store)) return false;
  return ran(c.run(store));
}

/** Runs a command if it can run now. Returns whether it ran. */
export const runCommand = (jali: AnyJali, id: string): boolean => run(storeOf(jali), id);

export const commandById = (store: Pick<JaliStore, "env">, id: string) =>
  forEnv(store.env).byId.get(id);

/** Put the address on the clipboard, and say so ("Link copied"). */
export function copyLink(jali: AnyJali) {
  const store = storeOf(jali);
  const url = store.href();
  navigator.clipboard?.writeText(url).then(
    () => store.announce(store.messages.announcements.linkCopied),
    () => store.announce(store.messages.announcements.linkNotCopied),
  );
}

/** One pane off screen: show it. Several: move focus to the shelf toolbar (arrows choose, Enter shows). */
export function revealFromShelf(store: JaliStore) {
  const { m } = store.snapshot();
  const items = m.resolved.shelf;
  if (items.length > 1 && focusShelfChip(store.dom))
    return store.announce(store.messages.announcements.shelfChoose(items.length));
  const first = items.find((i) => m.tuckOf(i.paneId)) ?? items[0];
  if (first) store.actions.reveal(first.paneId);
}

/** The setting and what is said of it are one change: `changeSettings`, with its announcement. */
function toggleCentreDrop(store: JaliStore): ActionResult {
  return store.apply((x) => {
    const centreDrop = x.s.settings.centreDrop === "swap" ? "tab" : "swap";
    const o = changeSettings(x, { centreDrop });
    return isChange(o) ? { ...o, msg: messagesOf(x).announcements.centreDrop(centreDrop) } : o;
  }, "changeSettings");
}

/**
 * One entry of a command menu: what Jali's palette lists, for a host that shows Jali's commands in its own ⌘K
 * (cmdk, kbar, …). The focused pane's own commands come first, then the instance's and the host's.
 */
export interface ListedCommand {
  /** Unique in the list. Jali's commands use their command id; a pane's own are `pane:<id>`. */
  key: string;
  /** The command id: what `keymap` binds and `runCommand` runs. Undefined for a pane's own commands. */
  id?: string;
  title: string;
  /** "Focus", "Pane", "Layout", … for Jali's commands; the pane's title for a pane's own. */
  group: string;
  /** Its keys for this platform ("⌘K ⌘Z"), or "" when unbound. */
  keys: string;
  /** It can't run now. */
  disabled: boolean;
  /** Why, when Jali says (for a tooltip or screen readers). */
  reason?: string;
  /** Run it. Close your menu first: some commands move focus. */
  run: () => void;
}

/** Every command a person can run now, in palette order. Read it again after each change (`jali.subscribe`). */
export function listCommands(jali: AnyJali): ListedCommand[] {
  const store = storeOf(jali);
  const x = store.snapshot();
  const focused = x.s.view.focused;
  const own = ownOf(x.s.paneCommands, focused) ?? [];
  return [
    ...own.map((c): ListedCommand => ({
      key: `pane:${c.id}`,
      title: c.title,
      group: x.m.title(focused),
      keys: c.keys ?? "",
      disabled: !!c.disabled,
      ...(c.disabled ? { reason: c.disabled } : {}),
      run: c.run,
    })),
    ...commandDefsOf(store).map((c): ListedCommand => {
      const refused = c.check?.(x, store);
      return {
        key: c.id,
        id: c.id,
        title: c.title,
        group: c.group,
        // Esc closes a peek through the Esc ladder, not the keymap.
        keys:
          store.keymap.label(c.id) ||
          (c.id === "peek.close" ? store.keymap.format([{ key: "Escape" }]) : ""),
        disabled: !!refused,
        ...(refused?.msg ? { reason: refused.msg } : {}),
        run: () => void run(store, c.id),
      };
    }),
  ];
}
