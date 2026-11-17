/**
 * Chords: one description of a shortcut, used to match a keydown and to print it. Matching uses `code` for letters,
 * digits and punctuation (⌥ changes `key` on a Mac) and `key` for named keys. ⌘ on a Mac is Ctrl elsewhere.
 */
export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export interface Chord {
  /** `KeyboardEvent.code` ("KeyM", "Digit1", "Backslash") or, for named keys, `KeyboardEvent.key` ("ArrowLeft", "Enter"). */
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Text fields keep this key (⌘Z is their own undo). */
  notInText?: boolean;
}

const GLYPH: Record<string, string> = {
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Enter: "↵", Escape: "Esc", Backslash: "\\",
};
const keyLabel = (key: string) => GLYPH[key] ?? key.replace(/^(Key|Digit)/, "");

/** "⌥⇧⌘M" on a Mac, "Ctrl Alt Shift M" elsewhere. */
export function formatChord(c: Chord, mac = isMac): string {
  if (mac) return `${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.mod ? "⌘" : ""}${keyLabel(c.key)}`;
  return [c.mod && "Ctrl", c.alt && "Alt", c.shift && "Shift", keyLabel(c.key)].filter(Boolean).join(" ");
}

function editable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function matchChord(c: Chord, e: KeyboardEvent, mac = isMac): boolean {
  const mod = mac ? e.metaKey : e.ctrlKey;
  if (mod !== !!c.mod || e.altKey !== !!c.alt || e.shiftKey !== !!c.shift) return false;
  if (!c.mod && e.ctrlKey) return false;
  if (c.notInText && editable(e.target)) return false;
  return /^(Key|Digit)|^Backslash$/.test(c.key) ? e.code === c.key : e.key === c.key;
}

/** ⌘K: the palette, from anywhere (dialogs included). */
export const PALETTE_CHORD: Chord = { key: "KeyK", mod: true };
