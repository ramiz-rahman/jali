"use client"

import * as React from "react"
import { Progress as SdkProgress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from "@ui-sdk/react/progress"
import "#src/vendor/cyberspec/components/ui/cyber/loader.css"

const bootPhrases = ["Linking…", "Verifying keys…", "Mapping routes…", "Syncing cache…"]

// How long one phrase stays up while the progress isn't known. Slow enough
// that a screen reader can finish one before the next arrives.
const phraseMs = 2600

// A boot screen in miniature: a mark, what's loading, a hairline bar, the
// percentage in the signal color, and a status line that says what the
// machine is doing right now.
//
// - `value`: how far along, between `min` and `max` (0 to 100 unless set).
//   Leave it out, or pass null, while that isn't known: the bar hatches, a
//   highlight sweeps across it and the percentage is withheld.
// - `phrases`: the status lines. With a value they're spread across the
//   range, so each one is shown once, in order, as the work passes it;
//   without one they turn over on a timer. The line is a polite live
//   region, so a screen reader hears each change without being interrupted.
// - `doneLabel`: the status line once the value reaches `max`.
// - `fill`: covers its nearest positioned ancestor, for a whole screen.
// - `code`: a line of micro-print under the bar. Decoration only.
//
// With effects off the bar, the percentage and the status line still say
// everything; only the sweep, the caret and the mark's pulse stop.
function Loader({
  label,
  value = null,
  min = 0,
  max = 100,
  phrases = bootPhrases,
  doneLabel = "Link stable.",
  fill,
  code,
  getValueLabel,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<typeof SdkProgress>, "children" | "value" | "className" | "style"> & {
  label: string
  value?: number | null
  phrases?: string[]
  doneLabel?: string
  fill?: boolean
  code?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [turn, setTurn] = React.useState(0)
  const unknown = value == null
  const count = phrases.length

  React.useEffect(() => {
    if (!unknown || count < 2) return
    const timer = window.setInterval(() => setTurn((now) => now + 1), phraseMs)
    return () => window.clearInterval(timer)
  }, [unknown, count])

  // Where the value sits in its range, from 0 to 1. The bar is scaled by
  // this rather than given a width, so it can move without layout.
  const part = unknown || max <= min ? null : Math.min(1, Math.max(0, (value - min) / (max - min)))
  const done = part === 1
  const phrase = done ? doneLabel : count === 0 ? "" : part == null ? phrases[turn % count] : phrases[Math.min(count - 1, Math.floor(part * count))]

  return (
    <div
      data-kit="loader"
      data-fill={fill ? "" : undefined}
      data-state={done ? "complete" : unknown ? "indeterminate" : "progressing"}
      className={className}
      style={style}
    >
      <div data-kit="loader-body">
        <LoaderMark />
        <SdkProgress
          data-kit="loader-bar"
          value={value}
          min={min}
          max={max}
          // While there's no number, a screen reader gets a word for the
          // bar's value rather than nothing.
          getValueLabel={getValueLabel ?? ((current, details) => (current == null ? "In progress" : details.formatted))}
          style={{ "--loader-part": part ?? undefined } as React.CSSProperties}
          {...props}
        >
          <ProgressLabel data-kit="loader-label">{label}</ProgressLabel>
          <ProgressTrack data-kit="loader-track">
            <ProgressIndicator data-kit="loader-indicator" />
          </ProgressTrack>
          <ProgressValue data-kit="loader-value" />
        </SdkProgress>
        {/* Outside the progress bar, whose children assistive technology
            may flatten. The phrase is keyed so each new one arrives with
            the kit's change effect; the live region itself stays put. */}
        <p data-kit="loader-status" role="status">
          {phrase && (
            <span key={phrase} data-kit="loader-phrase">
              {phrase}
            </span>
          )}
        </p>
        {code && (
          <span data-kit="loader-code" data-micro aria-hidden>
            {code}
          </span>
        )}
      </div>
    </div>
  )
}

// The mark: a triangle with one corner cut, the way the kit's frames are,
// a second one nested in it point down, and a core that breathes while
// the work is under way.
function LoaderMark() {
  return (
    <svg data-kit="loader-mark" viewBox="0 0 64 56" fill="none" aria-hidden>
      <path data-part="outer" d="M32 3 61 53H14L8.8 43Z" />
      <path data-part="inner" d="M21 30h22L32 49Z" />
      <path data-part="core" d="M32 33.5l3.6 6.2h-7.2Z" />
      <path data-part="tick" d="M3 53h6M32 3V0" />
    </svg>
  )
}

export { Loader }
