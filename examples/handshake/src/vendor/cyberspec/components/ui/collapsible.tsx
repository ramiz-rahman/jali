"use client"

import * as React from "react"
import { Collapsible as SdkCollapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"
import { ChevronRight } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/collapsible.css"

// One section behind a key. The key runs the full width, with a chevron
// that steps round to point down while the section is open, and stays lit
// until it's closed again.
//
// - `label` is the key's text.
// - `summary` is a short readout at the end of the key that's there whether
//   it's open or not, like "3 entries". It's read as part of the key's name.
// - Everything else goes to the SDK's Collapsible: `open`, `defaultOpen`,
//   `onOpenChange`, `disabled`, `controller`. `keepMounted` and
//   `hiddenUntilFound` go to its panel.
function Collapsible({
  label,
  summary,
  keepMounted,
  hiddenUntilFound,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkCollapsible>, "children"> & {
  label: string
  summary?: string
  keepMounted?: boolean
  hiddenUntilFound?: boolean
  children: React.ReactNode
}) {
  return (
    <SdkCollapsible data-kit="collapsible" {...props}>
      <CollapsibleTrigger data-kit="collapsible-trigger" data-frame="notch br" data-press-flash="">
        <span data-kit="collapsible-glyph" aria-hidden>
          <ChevronRight />
        </span>
        <span data-kit="collapsible-text">
          <span data-kit="collapsible-label">{label}</span>
          {summary && <span data-kit="collapsible-summary">{summary}</span>}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel data-kit="collapsible-panel" keepMounted={keepMounted} hiddenUntilFound={hiddenUntilFound}>
        <div data-kit="collapsible-content">{children}</div>
      </CollapsiblePanel>
    </SdkCollapsible>
  )
}

export { Collapsible }
