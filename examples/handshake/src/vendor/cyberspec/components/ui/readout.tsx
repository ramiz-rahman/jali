"use client"

import * as React from "react"
import { fxMoves } from "#src/vendor/cyberspec/lib/fx.ts"
import { burst } from "#src/vendor/cyberspec/lib/glitch.ts"
import "#src/vendor/cyberspec/components/ui/cyber/readout.css"

type Tone = "signal" | "accent" | "flag" | "ok"
type Size = "sm" | "md" | "lg"

// The integer part in groups of three, and the decimals, of a number shown
// to `precision` places. The sign is kept apart so "-0.0" never prints.
function split(value: number, precision: number) {
  const fixed = Math.abs(value).toFixed(precision)
  const [whole = "", decimals] = fixed.split(".")
  const groups: string[] = []
  for (let end = whole.length; end > 0; end -= 3) groups.unshift(whole.slice(Math.max(0, end - 3), end))
  return { negative: value < 0 && Number(fixed) !== 0, groups, decimals }
}

// A figure on a display: the whole number large, its decimals and unit
// small beside it, in the signal color, over a short rule.
//
// When `value` changes the figure counts to the new number over a few
// hundred milliseconds and slips its channels as it lands. With FX off it
// simply changes. Assistive technology never hears the counting: it gets
// the label and the final value as plain text.
//
// - `precision`: decimal places shown.
// - `delta`: the change since last time. Prints ▲ or ▼ and the difference,
//   and is read as "up" or "down".
// - `tone`: "signal" for a value, "accent", "flag" for one to watch, "ok".
function Readout({
  value,
  label,
  unit,
  prefix,
  precision = 0,
  delta,
  size = "md",
  tone = "signal",
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value: number
  label: string
  unit?: string
  /** A mark printed before the figure, like a currency sign. */
  prefix?: string
  precision?: number
  delta?: number
  size?: Size
  tone?: Tone
}) {
  const [shown, setShown] = React.useState(value)
  // Where the figure is right now, so a change that arrives mid-count
  // carries on from there rather than jumping back.
  const at = React.useRef(value)
  const figure = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const from = at.current
    if (from === value) return
    if (!fxMoves() || !Number.isFinite(from) || !Number.isFinite(value)) {
      at.current = value
      setShown(value)
      return
    }
    let frame = 0
    let start = 0
    const step = (now: number) => {
      if (!start) start = now
      const t = Math.min(1, (now - start) / 420)
      // Fast at first, then settling: the last digits tick over slowly
      // enough to read.
      const current = t === 1 ? value : from + (value - from) * (1 - (1 - t) ** 3)
      at.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(step)
      else if (figure.current) burst(figure.current, 300)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])

  const { negative, groups, decimals } = split(shown, precision)
  const change = delta == null ? null : Math.abs(delta).toFixed(precision)
  const direction = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  const spoken = [
    `${prefix ? `${prefix} ` : ""}${value.toFixed(precision)}${unit ? ` ${unit}` : ""}`,
    direction === "flat" ? "no change" : direction ? `${direction} ${change}` : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div data-kit="readout" data-size={size} data-tone={tone} data-counting={shown === value ? undefined : ""} {...props}>
      <span data-kit="readout-label">{label}</span>
      <span data-sr-only>{spoken}</span>
      <span data-kit="readout-line" aria-hidden>
        <span ref={figure} data-kit="readout-figure">
          {prefix && <span data-kit="readout-prefix">{prefix}</span>}
          <span data-kit="readout-whole">
            {negative && "−"}
            {groups.map((group, index) => (
              <span key={groups.length - index}>{group}</span>
            ))}
          </span>
          {decimals && <span data-kit="readout-decimals">.{decimals}</span>}
          {unit && <span data-kit="readout-unit">{unit}</span>}
        </span>
        {direction && (
          <span data-kit="readout-delta" data-direction={direction}>
            {direction === "up" ? "▲" : direction === "down" ? "▼" : "■"} {change}
          </span>
        )}
      </span>
      <span data-kit="readout-rule" aria-hidden />
    </div>
  )
}

export { Readout }
export type { Size as ReadoutSize, Tone as ReadoutTone }
