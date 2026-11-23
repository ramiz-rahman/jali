"use client"

import * as React from "react"
import { Separator as SdkSeparator } from "@ui-sdk/react/separator"
import "#src/vendor/cyberspec/components/ui/cyber/separator.css"

// A rule between two groups of content: a faint line with a tick standing
// at each end, the way a measured span is drawn.
//
// - `label`: sets a word into the rule ("Uplinks"), which also names the
//   separator for a screen reader. `align` puts it near the start of the
//   rule (the default) or in the middle.
// - `orientation="vertical"` stands between items in a row and takes the
//   row's height. A vertical rule has no room for a word, so there a
//   `label` only names it.
// - `decorative`: the line says nothing the content around it doesn't. It's
//   hidden from assistive technology; a label set into it is then read as
//   plain text, like the "or" between two ways to sign in.
function Separator({
  label,
  align = "start",
  orientation = "horizontal",
  decorative,
  ...props
}: Omit<React.ComponentProps<typeof SdkSeparator>, "children"> & {
  label?: string
  align?: "start" | "center"
}) {
  const drawn = label != null && orientation !== "vertical"
  return (
    <SdkSeparator
      data-kit="separator"
      data-labelled={drawn ? "" : undefined}
      data-align={drawn ? align : undefined}
      orientation={orientation}
      decorative={decorative}
      aria-label={decorative ? undefined : label}
      {...props}
    >
      {/* A separator's name comes from aria-label, so the printed word is
          hidden from assistive technology unless the line itself is. */}
      {drawn && (
        <span data-kit="separator-label" aria-hidden={decorative ? undefined : true}>
          {label}
        </span>
      )}
    </SdkSeparator>
  )
}

export { Separator }
