"use client"

import * as React from "react"
import "#src/vendor/cyberspec/components/ui/cyber/reticle.css"

// The lock-on bracket: four corner marks standing off whatever it wraps,
// which snap in against it when the pointer arrives, when focus moves
// inside, or while `active`.
//
// It's decoration over a real target. The brackets and the tag are hidden
// from assistive technology and never take the pointer, so what's inside
// keeps its own name, focus ring and presses.
//
// - `active`: holds the lock.
// - `tag`: a word printed at a corner while locked ("LOCK", "TRACK"). Not
//   announced, so don't let it be the only place a fact lives.
// - `tagAt`: which corner the tag sits at.
function Reticle({
  active,
  tag,
  tagAt = "top-end",
  children,
  ...props
}: React.ComponentProps<"span"> & {
  active?: boolean
  tag?: string
  tagAt?: "top-start" | "top-end" | "bottom-start" | "bottom-end"
}) {
  return (
    <span data-kit="reticle" data-active={active ? "" : undefined} {...props}>
      {children}
      <span data-kit="reticle-brackets" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </span>
      {tag && (
        <span data-kit="reticle-tag" data-at={tagAt} aria-hidden>
          {tag}
        </span>
      )}
    </span>
  )
}

export { Reticle }
