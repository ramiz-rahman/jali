import * as React from "react"
import {
  ScrollArea as SdkScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area"
import "#src/vendor/cyberspec/components/ui/cyber/scroll-area.css"

const length = (value: number | string | undefined) => (typeof value === "number" ? `${value}px` : value)

// A region that scrolls on its own, for a log or a long list inside a
// panel. The browser does the scrolling, so the wheel, touch, the keyboard
// and find in page work as usual; the kit draws a thin track with a thumb
// that has one end cut, and marks an edge with a shade and an arrow while
// there's more past it.
//
// - `label` names the region ("Signal log"). A region with nothing
//   focusable inside is a tab stop itself, so the arrow keys can scroll it.
// - `height` fixes how tall it is; `maxHeight` lets it grow with its
//   content up to a limit. A number is in pixels.
//
// The rest goes to ui-sdk's ScrollArea: `type` (when the scrollbar shows;
// here it shows whenever there's something to scroll), `stickToEnd` for a
// log that follows its newest line, `controller`.
function ScrollArea({
  label,
  height,
  maxHeight,
  children,
  style,
  ...props
}: Omit<React.ComponentProps<typeof SdkScrollArea>, "children" | "style"> & {
  label: string
  height?: number | string
  maxHeight?: number | string
  children?: React.ReactNode
  style?: React.CSSProperties
}) {
  const size = {
    "--area-height": length(height),
    "--area-max-height": length(maxHeight),
    ...style,
  } as React.CSSProperties
  return (
    <SdkScrollArea data-kit="scroll-area" type="auto" style={size} {...props}>
      <ScrollAreaViewport data-kit="scroll-area-viewport" role="region" aria-label={label}>
        <ScrollAreaContent data-kit="scroll-area-content">{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      <span data-kit="scroll-area-edge" data-edge="start" aria-hidden />
      <span data-kit="scroll-area-edge" data-edge="end" aria-hidden />
      <ScrollAreaScrollbar data-kit="scroll-area-scrollbar" orientation="vertical">
        <ScrollAreaThumb data-kit="scroll-area-thumb" />
      </ScrollAreaScrollbar>
    </SdkScrollArea>
  )
}

export { ScrollArea }
