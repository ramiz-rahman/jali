/**
 * One command registry (spec §0.2): every workspace command has a stable id, a title, a check and a run. Keys are
 * not here: the store's keymap (commands/keymap.ts) binds ids to keys, so a host can rebind or unbind any of them.
 * The palette lists every command (disabled while the check refuses) with its keys; the keyboard runs the command a
 * binding names (and says a refusal's reason); tooltips print `store.keymap.label(id)`.
 */
import { checkAutoLayout } from "../actions/layout";
import { notAllowed, type PaneControl } from "../actions/allow";
import type { Edge, NodeId } from "../layout/types";
import { checkUndo } from "../actions/close";
import { checkZoom } from "../actions/focus";
import { checkPeek } from "../actions/peek";
import { checkPutBack, checkTuck } from "../actions/tuck";
import { checkMerge, checkMoveTab, checkUnmerge } from "../actions/tabs";
import { checkRename } from "../actions/rename";
import { activeTabId, focusShelfChip } from "../dom/focus";
import type { Env } from "../profile";
import { refuse, type RefusalStep, type Snapshot } from "../state/apply";
import { messagesOf, type ScreenDirection } from "../state/messages";
import type { UiStore } from "../state/store";
import { storeOf, type Jali } from "../state/instance";
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
  /** Why the command can't run now (silent without a message); undefined when it can. */
  check?: (x: Snapshot) => RefusalStep | undefined;
  run: (store: UiStore) => void;
}

/**
 * How the framework adapter pops a pane out into a floating window (@jali/react's, set as it loads): `can` says
 * whether this browser can, `run` opens the pane. Core has no window of its own to open, so without one `pane.pop_out`
 * can't run.
 */
export interface PopOutPort {
  can(): boolean;
  run(jali: Jali, pane: NodeId): unknown;
}
let popOutPort: PopOutPort | null = null;
/** Set (or clear) the adapter's way to pop a pane out (adapters). */
export const setPopOutPort = (port: PopOutPort | null) => {
  popOutPort = port;
};

/** `check`, then the app's `allow` for the focused pane (a command for something it doesn't allow is greyed out,
 *  saying why). Leaving maximise or full screen is always allowed. */
const also =
  (check: (x: Snapshot) => RefusalStep | undefined, control: PaneControl) =>
  (x: Snapshot): RefusalStep | undefined => {
    const id = x.s.view.focused;
    const leaving =
      (control === "maximise" && x.s.view.zoomed === id) ||
      (control === "fullScreen" && x.s.fullScreen === id);
    return check(x) ?? (leaving ? undefined : notAllowed(x, id, control));
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

/** Every command a workspace has: the fixed set, its presets', and titles in its own words (its name, its viewers). */
function buildCommands(env: Env): CommandDef[] {
  const { commands: t, commandGroups: g } = messagesOf(env);
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
      check: also(checkZoom, "maximise"),
      run: (u) => u.actions.toggleZoom(),
    },
    {
      id: "pane.fullscreen",
      title: t.fullScreen,
      group: g.pane,
      check: also(
        ({ s }) => (s.page?.mode === "single" ? refuse("single-view") : undefined),
        "fullScreen",
      ),
      run: (u) => u.actions.toggleFullScreen(),
    },
    // Only where the app turns pop out on (`allow: { popOut: true }`): the pane menu's Pop out, from ⌘K or a key.
    ...(env.allow?.popOut === true
      ? [
          {
            id: "pane.pop_out",
            title: t.popOut,
            group: g.pane,
            check: also(
              (x) => needFocus(x) ?? (popOutPort?.can() ? undefined : refuse("unavailable")),
              "popOut",
            ),
            run: (u: UiStore) => {
              const id = u.get().view.focused;
              if (id) void popOutPort?.run(u.jali, id);
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
      run: (u) => u.actions.putBack(undefined, activeTabId()),
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
      check: needOthers,
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
      check: needLauncher,
      run: (u) => u.actions.split("right"),
    },
    {
      id: "pane.split.down",
      title: t.splitDown,
      group: g.pane,
      check: needLauncher,
      run: (u) => u.actions.split("bottom"),
    },
    {
      id: "pane.split.auto",
      title: t.splitAuto,
      group: g.pane,
      check: needLauncher,
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

    // Merge and unmerge without dragging (WCAG 2.5.7).
    {
      id: "pane.merge",
      title: t.merge,
      group: g.tabs,
      check: also(checkMerge, "move"),
      run: (u) => u.set({ chooser: { kind: "merge", source: u.get().view.focused! } }),
    },
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
      run: (u: UiStore) => u.actions.moveTabToward(side),
    })),
    {
      id: "pane.rename",
      title: t.rename,
      group: g.pane,
      check: checkRename,
      run: (u) => u.actions.startRename(),
    },
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
    // A curated page's own commands, from its engine (actions/page.ts): only a workspace with a page has them.
    ...(env.page?.commands(env) ?? []),

    {
      id: "peek.close",
      title: t.peekClose,
      group: g.peek,
      check: checkPeek,
      run: (u) => u.actions.peek(null),
    },
    {
      id: "peek.open_beside",
      title: t.peekOpenBeside,
      group: g.peek,
      check: checkPeek,
      run: (u) => u.actions.openPeekBeside(),
    },
    {
      id: "peek.open_full",
      title: t.peekOpenFull,
      group: g.peek,
      check: checkPeek,
      run: (u) => u.actions.openPeekFull(),
    },

    {
      id: "settings.open",
      title: t.settingsOpen,
      group: g.settings,
      run: (u) => u.actions.openSettings(),
    },
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
const built = new WeakMap<Env, Built>();
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

/** The workspace's commands, in palette order. Same array per workspace. */
export const commandsOf = (jali: Pick<Jali, "env">): readonly Command[] =>
  forEnv(jali.env).commands;

/** The registry's commands, with their checks (adapters). */
export const commandDefsOf = (store: Pick<UiStore, "env">): readonly CommandDef[] =>
  forEnv(store.env).defs;

function run(store: UiStore, id: string): boolean {
  const c = forEnv(store.env).byId.get(id);
  if (!c || c.check?.(store.snapshot())) return false;
  c.run(store);
  return true;
}

/** Runs a command if it can run now. Returns whether it ran. */
export const runCommand = (jali: Jali, id: string): boolean => run(storeOf(jali), id);

export const commandById = (store: Pick<UiStore, "env">, id: string) =>
  forEnv(store.env).byId.get(id);

/** "⌘K ⌘M": a command's first binding in this store's keymap, for tooltips and the palette ("" when unbound). */
export const shortcutLabel = (store: Pick<UiStore, "keymap">, id: string) => store.keymap.label(id);

/** Put the address on the clipboard, and say so ("Link copied"). */
export function copyLink(jali: Jali) {
  const store = storeOf(jali);
  const url = store.href();
  navigator.clipboard?.writeText(url).then(
    () => store.announce(store.messages.announcements.linkCopied),
    () => store.announce(store.messages.announcements.linkNotCopied),
  );
}

/** One pane off screen: show it. Several: move focus to the shelf toolbar (arrows choose, Enter shows). */
export function revealFromShelf(store: UiStore) {
  const { m } = store.snapshot();
  const items = m.resolved.shelf;
  if (items.length > 1 && focusShelfChip(store.dom))
    return store.announce(store.messages.announcements.shelfChoose(items.length));
  const first = items.find((i) => m.tuckOf(i.paneId)) ?? items[0];
  if (first) store.actions.reveal(first.paneId);
}

function toggleCentreDrop(store: UiStore) {
  const settings = store.get().settings;
  const centreDrop = settings.centreDrop === "swap" ? "tab" : "swap";
  store.set({ settings: { ...settings, centreDrop } });
  store.announce(store.messages.announcements.centreDrop(centreDrop));
}

/**
 * One entry of a command menu: what Jali's palette lists, for a host that shows Jali's commands in its own ⌘K
 * (cmdk, kbar, …). The focused pane's own commands come first, then the workspace's and the host's.
 */
export interface ListedCommand {
  /** Unique in the list. Workspace commands use their command id; a pane's own are `pane:<id>`. */
  key: string;
  /** The command id: what `keymap` binds and `runCommand` runs. Undefined for a pane's own commands. */
  id?: string;
  title: string;
  /** "Focus", "Pane", "Layout", … for workspace commands; the pane's title for a pane's own. */
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
export function listCommands(jali: Jali): ListedCommand[] {
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
      const refused = c.check?.(x);
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
