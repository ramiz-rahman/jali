/**
 * How an instance starts: the development checks of its options, the layout it opens on, and its first state. The
 * store is made from these (state/store.ts) and takes it from there.
 */
import * as core from "../layout/engine";
import type { LayoutInput } from "../layout/build";
import type { Direction, Layout } from "../layout/types";
import type { PaneErrorInfo } from "../pane-kinds";
import { readLayout } from "../actions/layout";
import type { Env, Preset } from "../env";
import type { StoragePort } from "../ports";
import { initialArea } from "../tokens";
import { pageDirection } from "../dom/direction";
import { loadPrefs } from "./page-prefs";
import type { PaneStateSync } from "./pane-state";
import { loadSettings, systemPrefersDark, type Settings } from "./settings";
import type { JaliConfig, UiState } from "./store";

declare const process: { env: { NODE_ENV?: string } };

/**
 * Development-only defaults and checks, behind a literal `process.env.NODE_ENV` test: a production build replaces it
 * with `false` and drops all of it, messages included; an unbundled page, which has no `process`, lands in the catch
 * and is production (dev.ts). `paneError` and `unstable` are what development says when the app gives none.
 */
export function developmentChecks(deps: JaliConfig): {
  dev: boolean;
  paneError?: (error: unknown, info: PaneErrorInfo) => void;
  unstable?: (op: string) => void;
} {
  try {
    if (process.env.NODE_ENV !== "production") {
      const presets = deps.presets ?? [];
      const scope = deps.keyboard?.scope;
      if (scope !== undefined && scope !== "page" && scope !== "local")
        console.error(`Jali: keyboard.scope is "page" or "local", not ${JSON.stringify(scope)}`);
      for (const [i, p] of presets.entries())
        if (presets.findIndex((q) => q.id === p.id) !== i)
          console.error(`Jali: two presets have the id "${p.id}"`);
      if (deps.preset !== undefined && !presets.some((p) => p.id === deps.preset))
        console.error(`Jali: there is no preset "${deps.preset}"`);
      return {
        dev: true,
        paneError: (error, { pane, ref }) =>
          console.error(`Jali: pane ${pane ?? "peek"} (${ref.kind}) failed`, error),
        unstable: (op) =>
          console.error(`Layout stability: "${op}" never moves anything, but moved panes`),
      };
    }
  } catch {
    /* no `process`: production */
  }
  return { dev: false };
}

/** The instance's first state: `first.layout`, what this device kept (settings, the page's mode and layout, pane
 *  state), and `initial` over all of it. */
export function initialState(o: {
  env: Env;
  storage: StoragePort;
  paneStates: PaneStateSync;
  first: { layout: Layout; preset?: Preset };
  start: Preset | undefined;
  settings?: Partial<Settings>;
  dir?: Direction;
  initial?: Partial<UiState>;
}): UiState {
  const { env, storage, first } = o;
  return {
    page: null,
    prefs: loadPrefs(storage, env.profile?.id, env.kinds.registry()),
    view: { focusHistory: [] },
    // A layout that can't be shown gave way to a preset: the instance is on that preset.
    presetId: (first.preset ?? o.start)?.id,
    settings: loadSettings(storage, o.settings),
    systemDark: systemPrefersDark(),
    undoStack: [],
    activity: {},
    selection: {},
    dnd: null,
    resizeMode: null,
    paletteOpen: false,
    settingsOpen: false,
    chooser: null,
    renaming: null,
    wide: null,
    recent: [],
    area: initialArea(env.spacing.inset),
    dir: o.dir ?? pageDirection(),
    announcement: { text: "", seq: 0 },
    reshapes: 0,
    ghost: null,
    unsaved: {},
    confirm: null,
    paneCommands: {},
    titles: {},
    paneAttributes: {},
    paneReports: {},
    ...o.paneStates.read(),
    paneStateHeld: {},
    selectionOf: {},
    ...o.initial,
    // The layout given, once checked (`firstLayout`), or what took its place.
    layout: first.layout,
  };
}

/**
 * In development, the layout and view an instance commits are frozen, so an app that edits what `get()`,
 * `getLayout()` or an event gave it fails at once, instead of changing the instance behind its back (no history, no
 * event, a model cache that no longer matches). Refs and the peek are frozen too: every one was copied where it entered
 * (state/ingress.ts), so none is the app's own. What is frozen already (shared with the last commit) is not walked again.
 */
export function freezeTree(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  // Frozen before its parts are walked, so a part that refers back stops at it.
  Object.freeze(value);
  for (const v of Object.values(value)) freezeTree(v);
}

/**
 * The layout an instance starts on, checked as `setLayout` and links check theirs (`core.validate`): the one given
 * (`createJali({ layout })`, often one the app saved), else the preset it opens on, the other presets, the curated
 * page, and a lone launcher, in that order. A layout that can't be shown (a kind removed since it was saved, two
 * panes with one id, a malformed tree) is skipped, and development says why. Throws only when nothing can be shown.
 */
export function firstLayout(
  env: Env,
  given: Layout | undefined,
  start: Preset | undefined,
  dev: boolean,
): { layout: Layout; preset?: Preset; page?: true } {
  // A copy (the app's own object is never frozen or kept). A ref its kind's params can't read still opens, in the
  // kind's `Missing`, as an app's layout always has.
  const read = (input: LayoutInput | (() => LayoutInput)) => readLayout(input, env, false);
  // Why the layout given can't be shown, for development and for the error when nothing can be.
  const why = () => (given ? core.validate(given, env.kinds.registry(), { params: false }) : null);
  const done = (r: { layout: Layout; preset?: Preset; page?: true }) => {
    try {
      if (process.env.NODE_ENV !== "production" && dev && given)
        console.error("Jali: the layout given can't be shown", why());
    } catch {
      /* no `process`: production */
    }
    return r;
  };
  let layout = given && read(given);
  if (layout) return { layout };
  for (const p of start ? [start, ...env.presets.filter((q) => q !== start)] : env.presets)
    if ((layout = read(p.build))) return done({ layout, preset: p });
  const p = env.profile,
    launcher = env.launcher;
  // The page's layout opens the page, as a page-only instance does.
  if (p && (layout = read(() => p.build(p.firstItem)))) return done({ layout, page: true });
  if (launcher && (layout = read({ kind: launcher, params: {} }))) return done({ layout });
  const r = why();
  throw new Error(
    `Jali: no layout to start from can be shown${r && !r.ok ? `: ${r.errors[0]}` : ""}`,
  );
}
