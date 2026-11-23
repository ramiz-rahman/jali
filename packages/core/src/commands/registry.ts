/**
 * One command registry (spec §0.2): every instance command has a stable id, a title and the step it runs. Keys are
 * not here: the store's keymap (commands/keymap.ts) binds ids to keys, so a host can rebind or unbind any of them.
 * A command is available exactly when its step's gate lets it run (`can`): the palette lists every command (disabled,
 * saying why, while it can't) with its keys; the keyboard runs the command a binding names (and says a refusal's
 * reason); tooltips print `store.keymap.label(id)`.
 */
import type { Edge } from "../layout/types";
import { serviceOf, type FeatureId } from "../features/feature";
import { activeTabId, focusShelfChip } from "../dom/focus";
import type { Env } from "../env";
import { can, type StepArgs, type StepName } from "../actions";
import { DONE, type ActionResult } from "../state/apply";
import { messagesOf, type ScreenDirection } from "../state/messages";
import type { JaliStore } from "../state/store";
import { storeOf, type AnyJali, type Jali } from "../state/instance";
import { cycleRegions } from "./regions";
import { own as ownOf } from "../own";

/** A command: one of Jali's (`listCommands`), or the app's own (`createJali({ commands })`). */
export interface Command {
  id: string;
  title: string;
  /** Jali's groups, or a host command's own. */
  group: "Focus" | "Pane" | "Move" | "Tabs" | "Layout" | "Peek" | "Settings" | (string & {});
  run: (jali: Jali) => void;
}

/** A command as the registry holds it (adapters): the step it runs, with the arguments worked out as it is listed and
 *  again as it runs. It can run exactly when the step can (`can`). Without a step (a host's command, F6) it always
 *  can. */
export interface CommandDef extends Omit<Command, "run"> {
  step?: StepName;
  /** The step's arguments: which pane, which way. Never a rule: whether it can run is the step's to say. */
  args?: (store: JaliStore) => readonly unknown[];
  /** What it does in place of running its step, once its step says it can (a dialog, a window, DOM focus). */
  run?: (store: JaliStore) => ActionResult | void;
}

const DIRS: [Edge, ScreenDirection][] = [
  ["left", "left"],
  ["right", "right"],
  ["top", "up"],
  ["bottom", "down"],
];

/** Every command an instance has: the fixed set, its presets', its features' (each only with its feature, in its
 *  words) and the host's, with titles in its own words (its name). */
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
      step: "focusDirection",
      args: () => [d],
    })),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): CommandDef => ({
      id: `pane.focus.${n}`,
      title: t.focusIndex(n),
      group: g.focus,
      step: "focusIndex",
      args: () => [n],
    })),

    { id: "pane.zoom", title: t.zoom, group: g.pane, step: "toggleZoom" },
    { id: "pane.fullscreen", title: t.fullScreen, group: g.pane, step: "toggleFullScreen" },
    // With `popOut()`: the pane menu's Pop out, from ⌘K or a key, through the feature's window.
    ...(popOut
      ? [
          {
            id: "pane.pop_out",
            title: t.popOut,
            group: g.pane,
            step: "popOut" as const,
            run: (u: JaliStore) => void popOut.open(u, u.get().view.focused!),
          },
        ]
      : []),
    { id: "pane.tuck", title: t.tuck, group: g.pane, step: "tuck" },
    // A tucked tab with DOM focus is the one put back first.
    {
      id: "pane.putBack",
      title: t.putBack,
      group: g.pane,
      step: "putBack",
      args: (u) => [undefined, activeTabId(u.dom)],
    },
    {
      id: "shelf.reveal",
      title: t.revealFromShelf,
      group: g.pane,
      step: "revealShelf",
      run: revealFromShelf,
    },
    { id: "pane.resize_mode", title: t.resizeMode, group: g.pane, step: "enterResizeMode" },
    { id: "pane.close", title: t.close, group: g.pane, step: "close" },
    { id: "pane.close_others", title: t.closeOthers, group: g.pane, step: "closeOthers" },
    { id: "pane.undo_close", title: t.undoClose, group: g.pane, step: "undo" },
    // Splits open a launcher (a "New pane" to choose an object in), never a copy of the focused object.
    {
      id: "pane.split.right",
      title: t.splitRight,
      group: g.pane,
      step: "split",
      args: () => [undefined, "right"],
    },
    {
      id: "pane.split.down",
      title: t.splitDown,
      group: g.pane,
      step: "split",
      args: () => [undefined, "bottom"],
    },
    { id: "pane.split.auto", title: t.splitAuto, group: g.pane, step: "splitAuto" },

    ...DIRS.map(([d, w]): CommandDef => ({
      id: `pane.move.${w}`,
      title: t.moveDirection(w),
      group: g.move,
      step: "moveDirection",
      args: () => [d],
    })),
    // Out of a row that scrolls sideways, beside it: without dragging, and from the middle of the row in one step.
    { id: "pane.move.out", title: t.moveOutOfRow, group: g.move, step: "moveOutOfRow" },
    { id: "pane.swap", title: t.swap, group: g.move, step: "swapWithNext" },

    // Merge (with the chooser, `chooser()`) and unmerge without dragging (WCAG 2.5.7).
    ...(has("chooser")
      ? [{ id: "pane.merge", title: t.merge, group: g.tabs, step: "openMergeChooser" as const }]
      : []),
    { id: "pane.unmerge", title: t.unmerge, group: g.tabs, step: "unmerge" },
    ...(["left", "right"] as const).map((side): CommandDef => ({
      id: `tab.move.${side}`,
      title: t.moveTab(side),
      group: g.tabs,
      step: "moveTabToward",
      args: () => [side],
    })),
    ...(has("rename")
      ? [{ id: "pane.rename", title: t.rename, group: g.pane, step: "startRename" as const }]
      : []),
    { id: "stack.new-tab", title: t.newTab, group: g.tabs, step: "newTab" },

    ...env.presets.map((p): CommandDef => ({
      id: `layout.preset.${p.id}`,
      title: t.preset(p.label),
      group: g.layout,
      step: "preset",
      args: () => [p.id],
    })),
    { id: "layout.reset", title: t.resetLayout, group: g.layout, step: "resetLayout" },
    { id: "layout.auto", title: t.autoLayout, group: g.layout, step: "autoLayout" },
    { id: "layout.copy_link", title: t.copyLink, group: g.layout, run: (u) => copyLink(u.jali) },
    // A curated page's own commands, from its engine (actions/page.ts): only an instance with a page has them.
    ...(env.page?.commands(env) ?? []),

    { id: "peek.close", title: t.peekClose, group: g.peek, step: "closePeek" },
    { id: "peek.open_beside", title: t.peekOpenBeside, group: g.peek, step: "openPeekBeside" },

    ...(has("settings")
      ? [
          {
            id: "settings.open",
            title: t.settingsOpen,
            group: g.settings,
            step: "dialogs.openSettings" as const,
          },
        ]
      : []),
    {
      id: "settings.centre_drop.toggle",
      title: t.centreDropToggle,
      group: g.settings,
      step: "toggleCentreDrop",
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
}
const built = /* @__PURE__ */ new WeakMap<Env, Built>();
const forEnv = (env: Env) => {
  let b = built.get(env);
  if (!b) {
    const all = buildCommands(env);
    const byId = new Map<string, CommandDef>();
    for (const c of all) if (!byId.has(c.id)) byId.set(c.id, c);
    const defs = all.filter((c) => byId.get(c.id) === c);
    b = { defs, byId };
    built.set(env, b);
  }
  return b;
};

/** The registry's commands, with their checks (adapters). */
export const commandDefsOf = (store: Pick<JaliStore, "env">): readonly CommandDef[] =>
  forEnv(store.env).defs;

/** Whether a command's result means it ran: done, or held for an answer (the host's `beforeClose`, or "Discard
 *  unsaved changes?"). A command that isn't an action (it opens a window) ran once its step said it can. */
const ran = (r: ActionResult | void) =>
  !r || r.ok || r.reason === "pending" || r.reason === "unsaved";

/** Whether command `c` can run now: what its step's gate says (`can`), with the arguments as they are now. */
export function commandAvailable(store: JaliStore, c: CommandDef): ActionResult {
  if (!c.step) return store.ended() ? { ok: false, reason: "unavailable" } : DONE;
  const args = (c.args?.(store) ?? []) as StepArgs<StepName>;
  return can(store, c.step, ...args);
}

/** Run command `c` (adapters: after `commandAvailable` said it can). */
export function runDef(store: JaliStore, c: CommandDef): ActionResult | void {
  if (c.run) return c.run(store);
  const args = (c.args?.(store) ?? []) as StepArgs<StepName>;
  return store.run(c.step!, ...args);
}

function run(store: JaliStore, id: string): boolean {
  const c = forEnv(store.env).byId.get(id);
  if (!c) return false;
  const answer = commandAvailable(store, c);
  // As a key does: a command that can't run says why, when Jali has words for it.
  if (answer.message) store.announce(answer.message);
  return answer.ok && ran(runDef(store, c));
}

/** Runs a command if it can run now, else says why (when Jali says). Returns whether it ran. */
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
  const items = store.model().resolved.shelf;
  if (items.length > 1 && focusShelfChip(store.dom))
    return store.announce(store.messages.announcements.shelfChoose(items.length));
  return store.run("revealShelf");
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
      const answer = commandAvailable(store, c);
      return {
        key: c.id,
        id: c.id,
        title: c.title,
        group: c.group,
        // Esc closes a peek through the Esc ladder, not the keymap.
        keys:
          store.keymap.label(c.id) ||
          (c.id === "peek.close" ? store.keymap.format([{ key: "Escape" }]) : ""),
        disabled: !answer.ok,
        ...(answer.message ? { reason: answer.message } : {}),
        run: () => void run(store, c.id),
      };
    }),
  ];
}
