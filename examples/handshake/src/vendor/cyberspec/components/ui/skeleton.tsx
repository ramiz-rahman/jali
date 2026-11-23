import * as React from "react"
import "#src/vendor/cyberspec/components/ui/cyber/skeleton.css"

type Shape = "line" | "block" | "tile"

// A length for a CSS variable: a bare number is pixels.
const length = (value: number | string | undefined) => (typeof value === "number" ? `${value}px` : value)

// A placeholder for content that hasn't arrived: a line of text drawn as
// redacted words, a block for a picture, or a tile for a portrait or an
// icon, with a highlight sweeping across each. It's decoration, so every
// piece is hidden from assistive technology; put the pieces in a
// SkeletonGroup, which says what is loading.
//
// - `shape`: "line" (text), "block" (a picture or a panel) or "tile" (a
//   square).
// - `width` and `height`: a number of pixels or any CSS length. A line is as
//   wide as its container unless told otherwise; a tile takes `width` for
//   both sides.
// - `lines`: for a line, how many to stack. The last one stops short, like
//   the end of a paragraph.
function Skeleton({
  shape = "line",
  width,
  height,
  lines = 1,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  shape?: Shape
  width?: number | string
  height?: number | string
  lines?: number
}) {
  const size = { "--skeleton-w": length(width), "--skeleton-h": length(height), ...style } as React.CSSProperties

  if (shape === "line" && lines > 1) {
    return (
      <span data-kit="skeleton-lines" aria-hidden style={size} {...props}>
        {Array.from({ length: lines }, (_, index) => (
          // Each line starts further into the word pattern, so no two lines
          // of a paragraph break in the same places.
          <span key={index} data-kit="skeleton" data-shape="line" style={{ "--i": index } as React.CSSProperties} />
        ))}
      </span>
    )
  }

  return (
    <span
      data-kit="skeleton"
      data-shape={shape}
      data-frame={shape === "block" ? "br" : shape === "tile" ? "tl br" : undefined}
      aria-hidden
      style={size}
      {...props}
    />
  )
}

// A row inside a group: a tile beside a column of lines, the way a list row
// or a card's heading is laid out.
function SkeletonRow(props: React.ComponentProps<"span">) {
  return <span data-kit="skeleton-row" {...props} />
}

// The container for a skeleton. It carries `aria-busy` while `busy`, and
// prints what's loading as a caption with a caret, so the placeholder says
// what it is to a screen reader, and to anyone with the effects off.
//
// - `label`: what is loading, "Loading" by default.
// - `framed` draws it as a card.
// - `busy`: set it false once the content is in, if the group stays mounted.
function SkeletonGroup({
  label = "Loading",
  framed,
  busy = true,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: string; framed?: boolean; busy?: boolean }) {
  return (
    <div data-kit="skeleton-group" data-frame={framed ? "br" : undefined} aria-busy={busy} {...props}>
      {children}
      <span data-kit="skeleton-caption">{label}</span>
    </div>
  )
}

export { Skeleton, SkeletonGroup, SkeletonRow }
export type { Shape as SkeletonShape }
