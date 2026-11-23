"use client"

import * as React from "react"
import { fxFull, onFxChange } from "#src/vendor/cyberspec/lib/fx.ts"
import "#src/vendor/cyberspec/components/ui/cyber/micro.css"

// The kit's printed decoration, as components: the serial numbers, barcodes,
// rules and registration marks in the margins of a screen. Every one of them
// is aria-hidden and ignores the pointer, so none may carry anything a
// person needs.

// A line of micro-print. `vertical` runs it down a spine.
function Micro({ vertical, ...props }: React.ComponentProps<"span"> & { vertical?: boolean }) {
  return <span data-kit="micro" data-micro="" data-vertical={vertical ? "" : undefined} aria-hidden {...props} />
}

// The bars of a code are read off the string: a guard at each end, and seven
// modules for each character, taken from a running hash so that one changed
// letter changes every bar after it.
function modules(value: string) {
  const bits = [1, 0, 1, 0]
  let hash = 2166136261
  for (const char of value) {
    hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619)
    bits.push(1)
    for (let i = 0; i < 5; i++) bits.push((hash >>> (i * 5 + 3)) & 1)
    bits.push(0)
  }
  bits.push(1, 0, 1)
  return bits
}

// A barcode whose bars are derived from `value`: the same string always
// prints the same code. `unit` is the width of one module and `size` the
// length of the bars, both in px; `vertical` stands it on end.
function Barcode({
  value,
  vertical,
  unit = 1,
  size = 18,
  style,
  ...props
}: Omit<React.ComponentProps<"svg">, "children"> & { value: string; vertical?: boolean; unit?: number; size?: number }) {
  const bits = React.useMemo(() => modules(value), [value])
  const bars: { at: number; length: number }[] = []
  for (let i = 0; i < bits.length; i++) {
    if (!bits[i]) continue
    const at = i
    while (bits[i + 1]) i++
    bars.push({ at, length: i - at + 1 })
  }
  return (
    <svg
      data-kit="barcode"
      data-vertical={vertical ? "" : undefined}
      viewBox={vertical ? `0 0 1 ${bits.length}` : `0 0 ${bits.length} 1`}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
      style={{ "--barcode-modules": bits.length, "--barcode-unit": `${unit}px`, "--barcode-size": `${size}px`, ...style } as React.CSSProperties}
      {...props}
    >
      {bars.map((bar) =>
        vertical ? <rect key={bar.at} x="0" y={bar.at} width="1" height={bar.length} /> : <rect key={bar.at} x={bar.at} y="0" width={bar.length} height="1" />,
      )}
    </svg>
  )
}

// A tick rule: a mark every `step` px, every fifth one longer. It fills the
// width of what it's in, or the height with `vertical`.
function Ruler({ vertical, step = 4, style, ...props }: React.ComponentProps<"span"> & { vertical?: boolean; step?: number }) {
  return (
    <span
      data-kit="ruler"
      data-vertical={vertical ? "" : undefined}
      aria-hidden
      style={{ "--ruler-step": `${step}px`, ...style } as React.CSSProperties}
      {...props}
    />
  )
}

// A small generator, so a stream's first rows are the same on every render
// of the same seed (and on the server).
function seeded(seed: string) {
  let state = 2166136261
  for (const char of seed) state = Math.imul(state ^ char.codePointAt(0)!, 16777619)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hexByte = (n: number) =>
  Math.floor(n * 256)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0")

// A column of hex bytes, like memory scrolling past. At FX "full" one row is
// rewritten every second or so and stays lit until the next; below that it's
// a still column. `rows` and `bytes` size it, `seed` picks its contents.
function DataStream({
  rows = 6,
  bytes = 2,
  seed = "CS-07",
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { rows?: number; bytes?: number; seed?: string }) {
  const row = React.useCallback((random: () => number) => Array.from({ length: bytes }, () => hexByte(random())).join(" "), [bytes])
  const first = React.useMemo(() => {
    const random = seeded(seed)
    return Array.from({ length: rows }, () => row(random))
  }, [rows, row, seed])
  const [state, setState] = React.useState<{ from: string[]; lines: string[]; fresh: number }>({ from: first, lines: first, fresh: -1 })
  // New props start a new column.
  const current = state.from === first ? state : { from: first, lines: first, fresh: -1 }
  const full = React.useSyncExternalStore(onFxChange, fxFull, () => false)

  React.useEffect(() => {
    if (!full) return
    const timer = setInterval(() => {
      setState((previous) => {
        const base = previous.from === first ? previous.lines : first
        const fresh = Math.floor(Math.random() * base.length)
        const lines = base.slice()
        lines[fresh] = row(Math.random)
        return { from: first, lines, fresh }
      })
    }, 1100)
    return () => clearInterval(timer)
  }, [full, first, row])

  return (
    <span data-kit="data-stream" data-micro="" aria-hidden {...props}>
      {current.lines.map((line, index) => (
        <span key={index} data-fresh={full && index === current.fresh ? "" : undefined}>
          {line}
        </span>
      ))}
    </span>
  )
}

// Registration marks for the four corners of a positioned parent: brackets
// that hug the corners, or crosses centered on them. `size` is the length of
// an arm and `inset` how far in from the parent's edge they sit, in px.
function Corners({
  variant = "bracket",
  size = 8,
  inset = 0,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { variant?: "bracket" | "cross"; size?: number; inset?: number }) {
  return (
    <span
      data-kit="corners"
      data-variant={variant}
      aria-hidden
      style={{ "--corners-size": `${size}px`, "--corners-inset": `${inset}px`, ...style } as React.CSSProperties}
      {...props}
    />
  )
}

export { Barcode, Corners, DataStream, Micro, Ruler }
