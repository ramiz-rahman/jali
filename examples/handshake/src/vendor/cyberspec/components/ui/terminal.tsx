import * as React from "react"
import { ChevronsDown } from "lucide-react"
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaScrollToEnd,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/terminal.css"

type Kind = "sys" | "agent" | "user" | "ok" | "warn" | "err"

type TerminalLine = {
  id: string
  kind: Kind
  // Printed as written: it wraps, and its line breaks and leading spaces are
  // kept, so a caller can indent sub-lines.
  text: string
  // The time as it's printed ("21:04", "00:12.4").
  time?: string
}

// What kind of line it is, as the word printed before it, and as the word a
// screen reader says in its place: "AGT" read aloud is three letters.
const tags: Record<Kind, string> = { sys: "SYS", agent: "AGT", user: "USR", ok: "OK", warn: "WARN", err: "ERR" }
const spoken: Record<Kind, string> = { sys: "System", agent: "Agent", user: "User", ok: "OK", warn: "Warning", err: "Error" }

// How many commands the prompt remembers.
const historyLimit = 100

// One line of the log. It's memoized on the line itself, so a log of
// hundreds renders only what's new when a line arrives.
const Line = React.memo(function Line({ line, fresh }: { line: TerminalLine; fresh: boolean }) {
  return (
    <div data-kit="terminal-line" data-kind={line.kind} data-new={fresh ? "" : undefined}>
      {line.time != null && <span data-kit="terminal-time">{line.time}</span>}
      <span data-kit="terminal-tag" aria-hidden>
        {tags[line.kind]}
      </span>
      <span data-sr-only>{spoken[line.kind]}: </span>
      <span data-kit="terminal-text">{line.text}</span>
    </div>
  )
})

// A console: the log of a session on a dark panel, and under it a prompt to
// answer with. It follows the newest line as lines arrive, lets go when
// someone scrolls up to read, and follows again once they're back at the
// bottom (or press the Latest key that appears meanwhile).
//
// - `label` names the log, and is printed over it. The prompt is named
//   "<label> command".
// - `lines`: `{ id, kind, text, time? }`, oldest first. The kind is printed
//   as a word as well as a color: SYS, AGT, USR, OK, WARN, ERR.
// - `onCommand`: with it, the prompt row is there. Enter sends what's typed
//   and clears the field, which keeps focus; ArrowUp and ArrowDown walk back
//   and forward through what was sent before.
// - `prompt`: the glyph before the field, ">" by default.
// - `busy`: something is still working. A caret blinks after the last line,
//   and "Working" is said once.
// - `height`: of the whole console, a number of pixels or any CSS length.
//
// New lines are announced politely. A line's text is always whole in the
// page the moment it arrives; only its entrance is animated, never its text.
function Terminal({
  label,
  lines,
  onCommand,
  prompt = ">",
  busy = false,
  placeholder,
  height,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: string
  lines: TerminalLine[]
  onCommand?: (text: string) => void
  prompt?: string
  busy?: boolean
  placeholder?: string
  height?: number | string
}) {
  const labelId = React.useId()
  const input = React.useRef<HTMLInputElement>(null)
  const [value, setValue] = React.useState("")

  // The commands sent so far, where in them the arrow keys have walked to
  // (the end is the line being typed), and that line, kept while walking.
  const history = React.useRef<string[]>([])
  const cursor = React.useRef(0)
  const draft = React.useRef("")

  // The line that arrived last, if it arrived after the console was first
  // shown: only that one tears in. A log that mounts full, or is replaced
  // wholesale, doesn't animate line by line.
  const lastId = lines.length ? lines[lines.length - 1]!.id : undefined
  const [tail, setTail] = React.useState<{ last: string | undefined; fresh: string | undefined }>({ last: lastId, fresh: undefined })
  if (tail.last !== lastId) setTail({ last: lastId, fresh: lastId })

  // The time column is as wide as the longest time, counted in characters:
  // a fixed width, so a line arriving never re-measures the ones before it.
  const timeWidth = React.useMemo(() => lines.reduce((width, line) => Math.max(width, line.time?.length ?? 0), 0), [lines])

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = value.trim()
    if (!text) return
    const sent = history.current
    if (sent[sent.length - 1] !== text) sent.push(text)
    if (sent.length > historyLimit) sent.shift()
    cursor.current = sent.length
    draft.current = ""
    setValue("")
    onCommand?.(text)
    input.current?.focus()
  }

  const walk = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const sent = history.current
    if (event.key === "ArrowUp") {
      if (!sent.length) return
      // The caret would jump to the start of the field otherwise.
      event.preventDefault()
      if (cursor.current === sent.length) draft.current = value
      cursor.current = Math.max(0, cursor.current - 1)
      setValue(sent[cursor.current] ?? "")
    } else if (event.key === "ArrowDown") {
      if (cursor.current >= sent.length) return
      event.preventDefault()
      cursor.current += 1
      setValue(cursor.current === sent.length ? draft.current : sent[cursor.current] ?? "")
    }
  }

  return (
    <div
      data-kit="terminal"
      data-busy={busy ? "" : undefined}
      data-times={timeWidth ? "" : undefined}
      style={
        {
          "--terminal-h": typeof height === "number" ? `${height}px` : height,
          "--terminal-time": timeWidth || undefined,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {/* The frame lights when the log itself has focus, which it takes
          whenever there's something to scroll. */}
      <div data-kit="terminal-log" data-frame={onCommand ? "tr" : "tr br"} data-frame-focus="within">
        <div data-kit="terminal-head">
          <span data-kit="terminal-lamp" aria-hidden />
          <span data-kit="terminal-label" id={labelId}>
            {label}
          </span>
          <span data-micro aria-hidden>
            TTY-07 // LN {String(lines.length).padStart(3, "0")}
          </span>
        </div>
        <ScrollArea data-kit="terminal-scroll" stickToEnd type="auto">
          <ScrollAreaViewport data-kit="terminal-viewport" role="log" aria-live="polite" aria-labelledby={labelId}>
            <ScrollAreaContent data-kit="terminal-lines">
              {lines.map((line) => (
                <Line key={line.id} line={line} fresh={line.id === tail.fresh} />
              ))}
              {busy && (
                <div data-kit="terminal-busy">
                  <span data-kit="terminal-caret" data-motion="essential" aria-hidden />
                  <span data-sr-only>Working</span>
                </div>
              )}
            </ScrollAreaContent>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar data-kit="terminal-scrollbar" orientation="vertical">
            <ScrollAreaThumb data-kit="terminal-thumb" />
          </ScrollAreaScrollbar>
          {/* Only there while the view is away from the end. */}
          <span data-kit="terminal-latest">
            <ScrollAreaScrollToEnd data-kit="button" data-frame="notch br" data-press-flash="" data-tone="signal" data-size="sm">
              <ChevronsDown aria-hidden />
              Latest
              <span data-sr-only> in {label}</span>
            </ScrollAreaScrollToEnd>
          </span>
        </ScrollArea>
      </div>
      {onCommand && (
        <form data-kit="terminal-prompt" data-frame="br" data-frame-focus="within" onSubmit={submit}>
          {/* A label, so a press anywhere on the row lands in the field. */}
          <label data-kit="terminal-field">
            <span data-kit="terminal-glyph" aria-hidden>
              {prompt}
            </span>
            <input
              ref={input}
              data-kit="terminal-input"
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={walk}
              aria-label={`${label} command`}
              placeholder={placeholder}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
            />
          </label>
        </form>
      )}
    </div>
  )
}

export { Terminal }
export type { TerminalLine }
