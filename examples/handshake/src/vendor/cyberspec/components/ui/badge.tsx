import * as React from "react"
import "#src/vendor/cyberspec/components/ui/cyber/badge.css"

type Tone = "accent" | "signal" | "flag" | "ok" | "rare" | "epic" | "mute"

// A small cut label: the tag on a list row, the count on a slot.
//
// - `tone`: "accent" is an outline; "flag" is the solid yellow of NEW and of
//   counts; "signal" marks what an agent did; "ok", "rare" and "epic" are
//   tinted outlines; "mute" recedes.
// - `count` prints a number instead of children, in tabular figures, and
//   stops at `max` ("99+"). `label` says what's being counted, for a screen
//   reader: `<Badge count={3} label="unread" />` reads "3 unread".
// - `status` puts a small square lamp before the text, for a state such as
//   Online. `live` lets that lamp breathe.
function Badge({
  tone = "accent",
  count,
  max = 99,
  label,
  status,
  live,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: Tone
  count?: number
  max?: number
  label?: string
  status?: boolean
  live?: boolean
}) {
  const counted = count != null
  return (
    <span
      data-kit="badge"
      data-frame="br"
      data-tone={tone}
      data-variant={counted ? "count" : status ? "status" : undefined}
      {...props}
    >
      {status && !counted && <span data-kit="badge-lamp" data-live={live ? "" : undefined} aria-hidden />}
      {counted ? (count > max ? `${max}+` : count) : children}
      {label && <span data-sr-only> {label}</span>}
    </span>
  )
}

export { Badge }
export type { Tone as BadgeTone }
