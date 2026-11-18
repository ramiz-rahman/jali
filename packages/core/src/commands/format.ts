/**
 * Keys: one description of a shortcut, used to match a keydown and to print it.
 *
 * Bindings are written as strings, the way people read them: "Mod+K Mod+M" is a two-step chord (hold Mod, press K,
 * then M). `Mod` is ⌘ on a Mac and Ctrl on Windows and Linux; `Ctrl` is the Control key on every platform. Matching
 * uses `KeyboardEvent.code` for letters, digits and punctuation (⌥ changes `key` on a Mac, and the physical key is
 * what a layout-independent binding means) and `KeyboardEvent.key` for named keys (arrows, Enter, Escape, F-keys).
 */

/** The platform shortcuts are matched and printed for. Pass it explicitly in tests and on the server. */
export type Platform = "mac" | "other";

export const detectPlatform = (): Platform =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "mac"
    : "other";

/** @deprecated read `store.keymap.platform`; kept for code that has no store at hand (content-level hints). */
export const isMac = detectPlatform() === "mac";

export interface Chord {
  /** `KeyboardEvent.code` ("KeyM", "Digit1", "Backslash") or, for named keys, `KeyboardEvent.key` ("ArrowLeft", "F6"). */
  key: string;
  /** ⌘ on a Mac, Ctrl elsewhere. */
  mod?: boolean;
  /** The Control key itself (on a Mac, distinct from ⌘). */
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/** One binding: a chord, or a prefix chord then a second chord. */
export type KeySequence = readonly Chord[];

const PUNCT: Record<string, string> = {
  "\\": "Backslash",
  "[": "BracketLeft",
  "]": "BracketRight",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "`": "Backquote",
  "-": "Minus",
  "=": "Equal",
};
const NAMED: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  enter: "Enter",
  return: "Enter",
  space: " ",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
};

function parseKey(token: string): string {
  if (/^[a-z]$/i.test(token)) return `Key${token.toUpperCase()}`;
  if (/^[0-9]$/.test(token)) return `Digit${token}`;
  if (PUNCT[token]) return PUNCT[token];
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(token)) return token.toUpperCase();
  if (/^(Key[A-Z]|Digit[0-9])$/.test(token) || Object.values(PUNCT).includes(token)) return token;
  const named = NAMED[token.toLowerCase()];
  if (named) return named;
  throw new Error(`Unknown key "${token}"`);
}

/** "Shift+Mod+ArrowLeft" → a chord. Modifier order does not matter; the key comes last. */
export function parseChord(text: string): Chord {
  const parts = text.split("+");
  // "Mod++" would be odd; a literal plus is written "Equal" with Shift. A trailing empty part means the key was "+".
  const keyToken = parts.pop()!;
  const c: Chord = { key: parseKey(keyToken) };
  for (const m of parts.map((p) => p.toLowerCase())) {
    if (m === "mod") c.mod = true;
    else if (m === "ctrl" || m === "control") c.ctrl = true;
    else if (m === "alt" || m === "option" || m === "opt") c.alt = true;
    else if (m === "shift") c.shift = true;
    else if (m === "meta" || m === "cmd") c.mod = true; // ⌘ means Mod: a Mac-only Meta binding has no Windows twin
    else throw new Error(`Unknown modifier "${m}" in "${text}"`);
  }
  return c;
}

/** "Mod+K Mod+M" → two chords. */
export const parseKeys = (text: string): KeySequence => text.trim().split(/\s+/).map(parseChord);

const GLYPH: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Enter: "↵",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "⌦",
  " ": "Space",
  Tab: "⇥",
};
const WORD: Record<string, string> = {
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Escape: "Esc",
  " ": "Space",
};
const PUNCT_LABEL = Object.fromEntries(Object.entries(PUNCT).map(([ch, code]) => [code, ch]));

function keyLabel(key: string, platform: Platform) {
  if (PUNCT_LABEL[key]) return PUNCT_LABEL[key];
  const named = platform === "mac" ? GLYPH[key] : WORD[key];
  return named ?? key.replace(/^(Key|Digit)/, "");
}

/** "⌥⇧⌘M" on a Mac (Apple's modifier order), "Ctrl+Alt+Shift+M" elsewhere. */
export function formatChord(c: Chord, platform: Platform = detectPlatform()): string {
  if (platform === "mac")
    return `${c.ctrl ? "⌃" : ""}${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${c.mod ? "⌘" : ""}${keyLabel(c.key, platform)}`;
  return [
    (c.mod || c.ctrl) && "Ctrl",
    c.alt && "Alt",
    c.shift && "Shift",
    keyLabel(c.key, platform),
  ]
    .filter(Boolean)
    .join("+");
}

/** "⌘K ⌘M" / "Ctrl+K Ctrl+M". */
export const formatKeys = (seq: KeySequence, platform: Platform = detectPlatform()) =>
  seq.map((c) => formatChord(c, platform)).join(" ");

/** A content-level hint ("Alt+Enter" → "⌥↵" or "Alt+Enter"), for keys a pane kind owns rather than the keymap. */
export const keyHint = (text: string, platform: Platform = detectPlatform()) =>
  formatKeys(parseKeys(text), platform);

/** The word for click-with-modifier hints: "⌥-click" / "Alt-click". */
export const altClick = (platform: Platform = detectPlatform()) =>
  platform === "mac" ? "⌥-click" : "Alt-click";

export function matchChord(
  c: Chord,
  e: KeyboardEvent,
  platform: Platform = detectPlatform(),
): boolean {
  const mac = platform === "mac";
  const mod = mac ? e.metaKey : e.ctrlKey;
  const ctrl = mac ? e.ctrlKey : false;
  if (
    mod !== !!(c.mod || (!mac && c.ctrl)) ||
    ctrl !== (mac && !!c.ctrl) ||
    e.altKey !== !!c.alt ||
    e.shiftKey !== !!c.shift
  )
    return false;
  if (!mac && e.metaKey) return false; // the Windows key is the OS's
  return /^(Key|Digit)/.test(c.key) || PUNCT_LABEL[c.key] ? e.code === c.key : e.key === c.key;
}

/** A printable key with no Mod, Ctrl or Alt: a character key shortcut (WCAG 2.1.4), which only content may bind. */
export const isCharacterKey = (c: Chord) =>
  !c.mod &&
  !c.ctrl &&
  !c.alt &&
  (/^(Key|Digit)/.test(c.key) || !!PUNCT_LABEL[c.key] || c.key === " ");

/** Text fields, editable regions and selects: native typing and editing keys live here. */
export function isEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ""));
}

/** Modifier keys pressed on their own (they start a chord; they are never one). */
export const isModifierKey = (e: KeyboardEvent) =>
  /^(Meta|Control|Alt|Shift|AltGraph|OS|CapsLock|Fn)$/.test(e.key);
