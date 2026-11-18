/**
 * The keymap: which keys run which command. A typed object with defaults that a host overrides or disables per
 * command (`createUiStore({ keymap: { "pane.close": "Mod+K Mod+X", "pane.zoom": null } })`). Nothing here is global:
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
  "pane.tuck": ["Mod+K Mod+["],
  "pane.putBack": ["Mod+K Mod+]"],
  "pane.resize_mode": ["Mod+K Mod+R"],
  "pane.close": ["Mod+K Mod+Backspace"],
  "pane.undo_close": ["Mod+K Mod+Z"],
  "pane.split.right": ["Mod+\\"],
  "pane.split.down": ["Mod+K Mod+\\"],
  "pane.merge": ["Mod+K Mod+G"],
  "pane.unmerge": ["Mod+K Shift+Mod+G"],
} as const satisfies Record<string, readonly KeyString[]>;

export type DefaultKeymapId = keyof typeof DEFAULT_KEYMAP;

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
  /** Called for each binding refused (unparsable, a bare character key, or a sequence longer than two). Default: console.warn. */
  onInvalid?: (id: string, binding: KeyString, reason: string) => void;
}

export interface Keymap {
  readonly platform: Platform;
  /** Every bound command and its key sequences, in the order given. */
  readonly entries: ReadonlyArray<readonly [id: string, sequences: readonly KeySequence[]]>;
  sequences(id: string): readonly KeySequence[];
  /** The first binding, formatted for this platform ("⌘K ⌘M" / "Ctrl+K Ctrl+M"); "" when unbound. */
  label(id: string): string;
  /** Command ids whose sequence is exactly `prefix` then a chord matching `match` (two-step), or `prefix` alone. */
  find(match: (c: Chord) => boolean, prefix?: Chord): string | undefined;
  /** Whether some binding starts with a chord matching `match` and has a second step. */
  isPrefix(match: (c: Chord) => boolean): Chord | undefined;
}

const sameChord = (a: Chord, b: Chord) =>
  a.key === b.key &&
  !!a.mod === !!b.mod &&
  !!a.ctrl === !!b.ctrl &&
  !!a.alt === !!b.alt &&
  !!a.shift === !!b.shift;

export function createKeymap(overrides: KeymapOverrides = {}, opts: KeymapOptions = {}): Keymap {
  const platform = opts.platform ?? detectPlatform();
  const warn =
    opts.onInvalid ??
    ((id, b, why) => console.warn(`[pane keymap] ${id}: "${b}" ignored (${why})`));
  const merged = new Map<string, readonly KeyString[]>(Object.entries(DEFAULT_KEYMAP));
  for (const [id, v] of Object.entries(overrides)) {
    if (v === undefined) continue;
    if (v === null) merged.delete(id);
    else merged.set(id, typeof v === "string" ? [v] : v);
  }
  const entries: [string, KeySequence[]][] = [];
  for (const [id, list] of merged) {
    const seqs: KeySequence[] = [];
    for (const b of list) {
      let seq: KeySequence;
      try {
        seq = parseKeys(b);
      } catch (err) {
        warn(id, b, (err as Error).message);
        continue;
      }
      if (seq.length > 2) warn(id, b, "a binding has at most two steps");
      else if (seq.length === 1 && isCharacterKey(seq[0]!))
        warn(id, b, "a single character key belongs to the focused content (WCAG 2.1.4)");
      else seqs.push(seq);
    }
    if (seqs.length) entries.push([id, seqs]);
  }
  const byId = new Map(entries);
  return {
    platform,
    entries,
    sequences: (id) => byId.get(id) ?? [],
    label: (id) => {
      const s = byId.get(id)?.[0];
      return s ? formatKeys(s, platform) : "";
    },
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
  };
}
