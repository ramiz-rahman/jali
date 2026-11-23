"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Popover as SdkPopover, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover"
import type { ButtonTone } from "#src/vendor/cyberspec/components/ui/button.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/popover.css"

type ContentProps = React.ComponentProps<typeof PopoverContent>

// A small panel that opens beside the key it belongs to, wired to it by a
// lead in the signal color. It isn't modal: the page stays usable, and
// focus leaving it, Escape or a press outside closes it.
//
// - `trigger` is the label of the key that opens it. Leave it out to open it
//   from a `controller`, and give it an `anchor` to sit against.
// - `title` names it; `description` is the line under that; `children` are
//   the body, which can hold controls. A `dl` in the body reads as a table
//   of facts.
// - `side` and `align` place it against the key. It flips and shifts by
//   itself when there isn't room.
// - `code` is the micro-print along its foot.
function Popover({
  trigger,
  triggerTone = "secondary",
  title,
  description,
  side = "bottom",
  align = "start",
  sideOffset = 8,
  anchor,
  code = "NODE 3F:A2 // DETAIL",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkPopover>, "children"> & {
  trigger?: React.ReactNode
  triggerTone?: ButtonTone
  title: string
  description?: string
  side?: ContentProps["side"]
  align?: ContentProps["align"]
  sideOffset?: number
  anchor?: ContentProps["anchor"]
  code?: string
  children?: React.ReactNode
}) {
  return (
    <SdkPopover {...props}>
      {trigger != null && (
        <PopoverTrigger data-kit="button" data-frame="notch br" data-press-flash="" data-tone={triggerTone}>
          {trigger}
        </PopoverTrigger>
      )}
      <PopoverContent
        data-kit="popover"
        side={side}
        align={align}
        sideOffset={sideOffset}
        anchor={anchor}
        collisionPadding={8}
        // The lead spans the gap to the key, so it needs to know how wide
        // the gap is.
        style={{ "--popover-gap": `${sideOffset}px` } as React.CSSProperties}
      >
        <div data-kit="popover-surface" data-frame="notch br">
          <PopoverTitle data-kit="popover-title">{title}</PopoverTitle>
          {description && <PopoverDescription data-kit="popover-description">{description}</PopoverDescription>}
          {children && <div data-kit="popover-body">{children}</div>}
          <span data-kit="popover-foot" data-micro aria-hidden>
            {code}
          </span>
          {/* Last in the page, first in the corner: focus opens on the
              body's first control when it has one, and the close key is the
              last stop before leaving. */}
          <div data-kit="popover-close">
            <PopoverClose data-kit="button" data-frame="br" data-press-flash="" data-tone="ghost" data-size="sm" data-icon="" aria-label="Close">
              <X aria-hidden />
            </PopoverClose>
          </div>
        </div>
      </PopoverContent>
    </SdkPopover>
  )
}

export { Popover }
