"use client"

import * as React from "react"
import { Tooltip as SdkTooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@ui-sdk/react/tooltip"
import "#src/vendor/cyberspec/components/ui/cyber/tooltip.css"

type ContentProps = React.ComponentProps<typeof TooltipContent>

// A cut label that appears beside whatever it wraps, once the pointer has
// rested there or keyboard focus has reached it, with a signal-colored edge
// on the side that faces it. Moving along a row of them, the next opens at
// once, without tearing in again.
//
// - `children` is the one element it belongs to: a Button, a link, anything
//   that takes a ref and can be focused. The tooltip names it when it has no
//   name of its own, so an icon key needs no aria-label, and describes it
//   when it does.
// - `content` is the label: a few plain words. It can't be focused, so
//   nothing interactive goes in it, and touch screens never show it, so it
//   is never the only place something is said.
// - `side` and `align` place it; it flips when there isn't room.
// - `shortcut` (like "mod+k") prints the keys beside the label. It's a hint
//   only: bind the keys on the control itself.
function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  ...props
}: Omit<React.ComponentProps<typeof SdkTooltip>, "children"> & {
  content: string
  children: React.ReactElement<Record<string, unknown>>
  side?: ContentProps["side"]
  align?: ContentProps["align"]
}) {
  return (
    <SdkTooltip {...props}>
      <TooltipTrigger render={children} />
      {/* A span, so it can sit beside a link inside a paragraph. */}
      <TooltipContent data-kit="tooltip" data-frame="br" render={<span />} side={side} align={align} sideOffset={6} collisionPadding={8}>
        {content}
        <TooltipShortcut data-kit="tooltip-shortcut" />
      </TooltipContent>
    </SdkTooltip>
  )
}

export { Tooltip }
