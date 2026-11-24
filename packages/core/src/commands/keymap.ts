/**
 * The keymap: which keys run which command. A typed object with defaults that a host overrides or disables per
 * command (`createJaliStore({ keymap: { "pane.close": "Mod+K Mod+X", "pane.zoom": null } })`). Nothing here is global:
 * each store resolves its own keymap, and the keyboard layer, tooltips, the status line, the palette and Settings all
 * read it from the store.
 *
 * Rules the defaults follow, and that overrides are checked against (docs/research/keyboard-shortcuts.md):
 * - Content first. Single character keys, ⌘Z/Ctrl+Z, Enter, Space and the first Esc belong to the focused content.
 *   A binding that is a single printable key with no Mod, Ctrl or Alt is refused (WCAG 2.1.4): content binds those,
 *   scoped to its own focus.
 * - No browser-reserved keys (⌘W/T/N, ⌘⇧T/N/W, ⌘⌥←/→, Ctrl+Tab, Ctrl+PgUp/PgDn …: the browser acts before the page
 *   sees them), no Ctrl+Alt (AltGr on Windows layouts), no ⌃⌥ (VoiceOver), no ⌘/Ctrl+digits (tab switching).
 * - One prefix, ⌘K / Ctrl+K: it opens the command palette and starts a two-step chord. The second step keeps Mod
 *   held (as VS Code's ⌘K ⌘←), so it never types into the palette's search.
 */
import {
  detectPlatform,
  formatKeys,
  isCharacterKey,
  parseKeys,
  type Chord,
  type KeySequence,
  type KeyWords,
  type Platform,
} from "./format";

/** Binding text: "Mod+\\", "F6", "Mod+K Mod+ArrowLeft". */
export type KeyString = string;

/** The keymap's own id for the palette (not a palette command: the palette doesn't list itself). */
export const PALETTE_ID = "palette.toggle";

export const DEFAULT_KEYMAP = {
  [PALETTE_ID]: ["Mod+K"],
  "pane.focus.next": ["F6"],
  "pane.focus.previous": ["Shift+F6"],
  "pane.focus.left": ["Mod+K Mod+ArrowLeft"],
  "pane.focus.right": ["Mod+K Mod+ArrowRight"],
  "pane.focus.up": ["Mod+K Mod+ArrowUp"],
  "pane.focus.down": ["Mod+K Mod+ArrowDown"],
  "pane.move.left": ["Mod+K Shift+Mod+ArrowLeft"],
  "pane.move.right": ["Mod+K Shift+Mod+ArrowRight"],
  "pane.move.up": ["Mod+K Shift+Mod+ArrowUp"],
  "pane.move.down": ["Mod+K Shift+Mod+ArrowDown"],
  // Maximise is the most used pane command: one direct chord (iTerm2, Warp), with the ⌘K form as a second binding.
  "pane.zoom": ["Mod+Shift+Enter", "Mod+K Mod+M"],
  // Full screen, maximise's bigger step: F for full screen, beside maximise's M. The keys people know for it (⌃⌘F on a
  // Mac, F11 elsewhere) are the browser's and the OS's, and put the whole window on the screen, not a pane. ⌘F on its
  // own stays the browser's find; as a second step it is ours (VS Code on the web ships ⌘K ⌘F too).
  "pane.fullscreen": ["Mod+K Mod+F"],
  "pane.tuck": ["Mod+K Mod+["],
  "pane.putBack": ["Mod+K Mod+]"],
  "pane.resize_mode": ["Mod+K Mod+R"],
  "pane.close": ["Mod+K Mod+Backspace"],
  "pane.undo_close": ["Mod+K Mod+Z"],
  "pane.split.right": ["Mod+\\"],
  "pane.split.down": ["Mod+K Mod+\\"],
  "pane.merge": ["Mod+K Mod+G"],
  "pane.unmerge": ["Mod+K Shift+Mod+G"],
  // A file manager's rename key. Content that uses F2 (a grid editing a cell) claims it first; a host that owns F2 lists
  // it in keyboard.reserved and calls jali.actions.startRename itself.
  "pane.rename": ["F2"],
  // A browser's and VS Code's move-tab keys (Ctrl+Shift+PageUp/PageDown), after the prefix.
  "tab.move.left": ["Mod+K Shift+PageUp"],
  "tab.move.right": ["Mod+K Shift+PageDown"],
} as const satisfies Record<string, readonly KeyString[]>;

/** The ids bound by default. Written out so a public type names no value; the check below keeps it equal to the table. */
export type DefaultKeymapId =
  | "palette.toggle"
  | "pane.focus.next"
  | "pane.focus.previous"
  | "pane.focus.left"
  | "pane.focus.right"
  | "pane.focus.up"
  | "pane.focus.down"
  | "pane.move.left"
  | "pane.move.right"
  | "pane.move.up"
  | "pane.move.down"
  | "pane.zoom"
  | "pane.fullscreen"
  | "pane.tuck"
  | "pane.putBack"
  | "pane.resize_mode"
  | "pane.close"
  | "pane.undo_close"
  | "pane.split.right"
  | "pane.split.down"
  | "pane.merge"
  | "pane.unmerge"
  | "pane.rename"
  | "tab.move.left"
  | "tab.move.right";
type SameIds = [DefaultKeymapId] extends [keyof typeof DEFAULT_KEYMAP]
  ? [keyof typeof DEFAULT_KEYMAP] extends [DefaultKeymapId]
    ? true
    : false
  : false;
export type DefaultIdsMatch = SameIds extends true
  ? true
  : { error: "DefaultKeymapId drifted from DEFAULT_KEYMAP" };
export const defaultIdsMatch: DefaultIdsMatch = true;

/**
 * A host's changes: a command id → its bindings (a string or several), or `null` to unbind it. Ids not listed keep
 * their defaults; ids not in the defaults (any registry command, or the host's own) may be bound too.
 */
export type KeymapOverrides = Partial<
  Record<DefaultKeymapId | (string & {}), KeyString | readonly KeyString[] | null>
>;

export interface KeymapOptions {
  /** Defaults to the running platform. */
  platform?: Platform;
  /**
   * The first step of every default two-step binding, and the palette's own key. Default "Mod+K". Move it when the
   * host owns ⌘K: `"Mod+J"` makes "pane.undo_close" ⌘J ⌘Z. Bindings in `overrides` are used as written.
   */
  prefix?: KeyString;
  /**
   * Keys the host app uses for itself. Any binding that is one of them, or starts with one, is dropped and reported
   * to `onInvalid`, so a clash shows up at start-up rather than when someone presses the key.
   */
  reserved?: readonly KeyString[];
  /** Called for each binding refused (unparsable, a bare character key, or a sequence longer than two). Default: console.warn. */
  onInvalid?: (id: string, binding: KeyString, reason: string) => void;
  /** The words printed keys use ("Ctrl", "Esc"). Default: English; an instance passes its `messages.keys`. */
  words?: KeyWords;
}

/**
 * Jali's keys, in one place (`createJali({ keyboard })`): which keys it takes, what each command is bound to, the
 * first step of its two-step keys, and the keys the app keeps for itself.
 */
export interface KeyboardOptions extends KeymapOptions {
  /**
   * Which keys Jali takes. `"page"` (the default): every key on the page. `"local"`: only keys from inside this
   * Jali (its panes and its dialogs), and keys on the page's body while it was the last one used, for two on one
   * page or Jali inside a larger app. Any other value is a development error, and local: a misspelling never widens
   * the keys Jali takes.
   */
  scope?: "page" | "local";
  /** Rebind or unbind commands: `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`. */
  keymap?: KeymapOverrides;
}

export interface Keymap {
  readonly platform: Platform;
  /** Every bound command and its key sequences, in the order given. */
  readonly entries: ReadonlyArray<readonly [id: string, sequences: readonly KeySequence[]]>;
  sequences(id: string): readonly KeySequence[];
  /** The first binding, formatted for this platform ("⌘K ⌘M" / "Ctrl+K Ctrl+M"); "" when unbound. */
  label(id: string): string;
  /** A key sequence formatted for this platform, in the instance's words ("Esc", "Ctrl+K Ctrl+M"). */
  format(seq: KeySequence): string;
  /** Command ids whose sequence is exactly `prefix` then a chord matching `match` (two-step), or `prefix` alone. */
  find(match: (c: Chord) => boolean, prefix?: Chord): string | undefined;
  /** Whether some binding starts with a chord matching `match` and has a second step. */
  isPrefix(match: (c: Chord) => boolean): Chord | undefined;
  /** The same bindings, matched and printed for `platform`: a server and a browser print the same labels
   *  until the page has hydrated (`@jali/react` prints "other" first). The same object for this keymap's own
   *  platform; refused bindings are not reported again. */
  forPlatform(platform: Platform): Keymap;
}

const sameChord = (a: Chord, b: Chord) =>
  a.key === b.key &&
  !!a.mod === !!b.mod &&
  !!a.ctrl === !!b.ctrl &&
  !!a.alt === !!b.alt &&
  !!a.shift === !!b.shift;

/** The default prefix every two-step default binding starts with. */
export const DEFAULT_PREFIX = "Mod+K";

/** `binding` with its first step moved from the default prefix to `prefix`. */
const withPrefix = (binding: KeyString, prefix: KeyString): KeyString =>
  binding === DEFAULT_PREFIX
    ? prefix
    : binding.startsWith(`${DEFAULT_PREFIX} `)
      ? `${prefix} ${binding.slice(DEFAULT_PREFIX.length + 1)}`
      : binding;

const sameSequence = (a: KeySequence, b: KeySequence) =>
  a.length === b.length && a.every((c, i) => sameChord(c, b[i]!));

export function createKeymap(overrides: KeymapOverrides = {}, opts: KeymapOptions = {}): Keymap {
  const platform = opts.platform ?? detectPlatform();
  const warn =
    opts.onInvalid ??
    ((id, b, why) => console.warn(`[pane keymap] ${id}: "${b}" ignored (${why})`));
  const prefix = opts.prefix ?? DEFAULT_PREFIX;
  const reserved: KeySequence[] = [];
  for (const b of opts.reserved ?? []) {
    try {
      reserved.push(parseKeys(b));
    } catch (err) {
      warn("keyboard.reserved", b, (err as Error).message);
    }
  }
  // A binding clashes when it is a reserved sequence, or starts with a reserved single key.
  const clash = (seq: KeySequence) =>
    reserved.find((r) => sameSequence(r, seq) || (r.length === 1 && sameChord(r[0]!, seq[0]!)));
  const merged = new Map<string, readonly KeyString[]>(
    Object.entries(DEFAULT_KEYMAP).map(([id, list]) => [
      id,
      list.map((b) => withPrefix(b, prefix)),
    ]),
  );
  for (const [id, v] of Object.entries(overrides)) {
    if (v === undefined) continue;
    if (v === null) merged.delete(id);
    else merged.set(id, typeof v === "string" ? [v] : v);
  }
  const entries: [string, KeySequence[]][] = [];
  // A key runs one command. The host's bindings (its overrides and its commands' keys) are placed first, so one on the
  // same keys as a default of Jali's wins: the default gives up that binding, and the warning names both. Between two
  // of the host's own, the first bound wins, and the second, which could never run, is refused and reported.
  const owner = (seq: KeySequence) =>
    entries.find(([, seqs]) => seqs.some((s) => sameSequence(s, seq)))?.[0];
  const fromHost = new Set(
    Object.entries(overrides)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([id]) => id),
  );
  const order = [...merged.keys()];
  const hostFirst = [...merged].sort(
    ([a], [b]) => Number(fromHost.has(b)) - Number(fromHost.has(a)),
  );
  for (const [id, list] of hostFirst) {
    const seqs: KeySequence[] = [];
    for (const b of list) {
      let seq: KeySequence;
      try {
        seq = parseKeys(b);
      } catch (err) {
        warn(id, b, (err as Error).message);
        continue;
      }
      const taken = clash(seq);
      const bound = owner(seq);
      if (seq.length > 2) warn(id, b, "a binding has at most two steps");
      else if (seq.length === 1 && isCharacterKey(seq[0]!))
        warn(id, b, "a single character key belongs to the focused content (WCAG 2.1.4)");
      else if (taken)
        warn(id, b, `the host reserves ${formatKeys(taken, platform)} (keyboard.reserved)`);
      else if (bound)
        warn(
          id,
          b,
          fromHost.has(id)
            ? `${formatKeys(seq, platform)} already runs ${bound}`
            : `${formatKeys(seq, platform)} runs ${bound}, which the app bound`,
        );
      else seqs.push(seq);
    }
    if (seqs.length) entries.push([id, seqs]);
  }
  // Back in the table's order, so the keys list as they always did.
  entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  const byId = new Map(entries);
  const others = new Map<Platform, Keymap>();
  const keymap: Keymap = {
    platform,
    entries,
    sequences: (id) => byId.get(id) ?? [],
    label: (id) => {
      const s = byId.get(id)?.[0];
      return s ? formatKeys(s, platform, opts.words) : "";
    },
    format: (seq) => formatKeys(seq, platform, opts.words),
    find(match, prefix) {
      for (const [id, seqs] of entries)
        for (const s of seqs) {
          if (
            prefix
              ? s.length === 2 && sameChord(s[0]!, prefix) && match(s[1]!)
              : s.length === 1 && match(s[0]!)
          )
            return id;
        }
      return undefined;
    },
    isPrefix(match) {
      for (const [, seqs] of entries)
        for (const s of seqs) if (s.length === 2 && match(s[0]!)) return s[0];
      return undefined;
    },
    forPlatform(p) {
      if (p === platform) return keymap;
      let other = others.get(p);
      if (!other) {
        other = createKeymap(overrides, { ...opts, platform: p, onInvalid: () => {} });
        others.set(p, other);
      }
      return other;
    },
  };
  return keymap;
}
