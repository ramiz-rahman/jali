import * as React from "react"
import { Button as SdkButton } from "@ui-sdk/react/button"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import "#src/vendor/cyberspec/components/ui/cyber/key-hint.css"

// Glyphs a screen reader would skip or misread, and what to say instead.
const spoken: Record<string, string> = {
  "↑": "Up",
  "↓": "Down",
  "←": "Left",
  "→": "Right",
  "↵": "Enter",
  "⏎": "Enter",
  "⎋": "Escape",
  "␣": "Space",
  "⇥": "Tab",
  "⇧": "Shift",
  "⌫": "Backspace",
  "⌘": "Command",
  "⌥": "Option",
  "⌃": "Control",
}

// What a printed key is called by a keyboard event, where the two differ.
const eventKeys: Record<string, string> = {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  return: "enter",
  space: " ",
  del: "delete",
  ctrl: "control",
  cmd: "meta",
  command: "meta",
  opt: "alt",
  option: "alt",
}

function eventKeyOf(glyph: string) {
  const name = (spoken[glyph] ?? glyph).toLowerCase()
  return eventKeys[name] ?? name
}

// One pair of listeners for every hint on the page. A key going down while
// someone is typing, or as part of a shortcut, isn't a hint's business.
type Watcher = (key: string | null, down: boolean) => void
const watchers = new Set<Watcher>()
const typing = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

function onKey(event: KeyboardEvent) {
  const down = event.type === "keydown"
  if (down && (event.metaKey || event.ctrlKey || event.altKey || (event.target as Element | null)?.closest?.(typing))) return
  const key = event.key.toLowerCase()
  watchers.forEach((watcher) => watcher(key, down))
}

// A key released while the window is elsewhere never reports it.
const onBlur = () => watchers.forEach((watcher) => watcher(null, false))

function watchKeys(watcher: Watcher) {
  if (!watchers.size) {
    document.addEventListener("keydown", onKey)
    document.addEventListener("keyup", onKey)
    window.addEventListener("blur", onBlur)
  }
  watchers.add(watcher)
  return () => {
    watchers.delete(watcher)
    if (watchers.size) return
    document.removeEventListener("keydown", onKey)
    document.removeEventListener("keyup", onKey)
    window.removeEventListener("blur", onBlur)
  }
}

// Which of these printed keys are being held on the keyboard right now.
function useHeld(glyphs: string[]) {
  const [held, setHeld] = React.useState<readonly string[]>([])
  const wanted = glyphs.map(eventKeyOf).join("\n")
  React.useEffect(() => {
    const mine = new Set(wanted.split("\n"))
    return watchKeys((key, down) => {
      if (key === null) return setHeld((now) => (now.length ? [] : now))
      if (!mine.has(key)) return
      setHeld((now) => (down ? (now.includes(key) ? now : [...now, key]) : now.filter((other) => other !== key)))
    })
  }, [wanted])
  return held
}

type KeyHintSpec = {
  /** The key, or keys, as printed: "X", "Esc", ["↑", "↓"]. */
  keys: string | string[]
  /** What it does: "Answer". */
  label: string
  /** Makes the hint a button that does the same thing, for a pointer or a finger. */
  onPress?: () => boolean | void
  /** Directional feedback for a hint that changes a value. */
  action?: "increment" | "decrement"
  disabled?: boolean
}

// The hint at the foot of a screen: a key glyph, then what the key does.
//
// - Each key is a <kbd> in a hexagon. Arrows and other symbols are read by
//   name ("Up", "Enter").
// - With `onPress` it's a real button, so the same action is there for a
//   pointer or a finger. Without it, it's text.
// - The glyph lights while its key is held on the keyboard, so the screen
//   answers the press. The hint only shows the key: binding it to the
//   action is the screen's job.
function KeyHint({ keys, label, onPress, action, disabled, ...props }: KeyHintSpec & Omit<React.ComponentProps<"span">, "children">) {
  const glyphs = Array.isArray(keys) ? keys : [keys]
  const held = useHeld(glyphs)
  const content = (
    <>
      <span data-kit="key-hint-keys">
        {glyphs.map((glyph) => (
          <kbd key={glyph} data-kit="key-hint-key" data-held={held.includes(eventKeyOf(glyph)) ? "" : undefined}>
            {glyph in spoken ? (
              <>
                <span aria-hidden>{glyph}</span>
                <span data-sr-only>{spoken[glyph]}</span>
              </>
            ) : (
              glyph
            )}
          </kbd>
        ))}
      </span>
      <span data-kit="key-hint-label">{label}</span>
    </>
  )

  if (!onPress)
    return (
      <span data-kit="key-hint" {...props}>
        {content}
      </span>
    )
  return (
    <SdkButton
      data-kit="key-hint"
      data-sfx={action ? "none" : undefined}
      disabled={disabled}
      onClick={() => {
        if (!disabled && onPress() !== false && action) sfx(action)
      }}
      {...(props as React.ComponentProps<typeof SdkButton>)}
    >
      {content}
    </SdkButton>
  )
}

// A row of hints, as a list: what the keys do on this screen. It sits at
// the trailing end of whatever it's in, the way the foot of a screen has
// it; `align` moves it.
function KeyHints({
  label = "Controls",
  hints,
  align = "end",
  ...props
}: Omit<React.ComponentProps<"ul">, "children"> & {
  label?: string
  hints: KeyHintSpec[]
  align?: "start" | "center" | "end"
}) {
  return (
    <ul data-kit="key-hints" data-align={align} aria-label={label} {...props}>
      {hints.map((hint) => (
        <li key={hint.label}>
          <KeyHint {...hint} />
        </li>
      ))}
    </ul>
  )
}

export { KeyHint, KeyHints }
export type { KeyHintSpec }
