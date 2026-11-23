"use client"

import * as React from "react"
import { KeyHints, type KeyHintSpec } from "#src/vendor/cyberspec/components/ui/key-hint.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/screen.css"

// The chrome every full screen shares: a status strip across the top (a few
// readouts on the left, anything else on the right), the screen's content,
// and a foot with key hints and a line of micro-print. It keeps the screens
// reading as pages of one machine.
//
// - `label` names the screen for assistive technology.
// - `status` and `aside` fill the two ends of the status strip.
// - `hints` are the keys this screen answers to.
// - `code` is the micro-print at the foot.
function Screen({
  label,
  status,
  aside,
  hints,
  code,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "aria-label"> & {
  label: string
  status?: React.ReactNode
  aside?: React.ReactNode
  hints?: KeyHintSpec[]
  code?: string
}) {
  return (
    <section data-kit="screen" aria-label={label} {...props}>
      {(status != null || aside != null) && (
        <div data-kit="screen-status">
          <div data-kit="screen-status-lead">{status}</div>
          {aside != null && <div data-kit="screen-status-aside">{aside}</div>}
        </div>
      )}
      <div data-kit="screen-body">{children}</div>
      {(hints?.length || code) && (
        <footer data-kit="screen-foot">
          {code && (
            <span data-micro aria-hidden>
              {code}
            </span>
          )}
          {hints?.length ? <KeyHints hints={hints} /> : null}
        </footer>
      )}
    </section>
  )
}

export { Screen }
