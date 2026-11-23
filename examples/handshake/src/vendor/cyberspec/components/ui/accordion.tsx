import * as React from "react"
import { Accordion as SdkAccordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@ui-sdk/react/accordion"
import "#src/vendor/cyberspec/components/ui/cyber/accordion.css"

type AccordionSection = {
  value: string
  label: string
  /** A short readout at the end of the row, like "3 loaded". It's read as part of the row's name. */
  meta?: string
  content: React.ReactNode
  disabled?: boolean
}

// Stacked sections, each behind a row: its number, its name, and a plus
// that turns into a minus as the section opens. The open row stays lit and
// its number reads in the signal color.
//
// - `items`: the sections, in order. `value` identifies one in `value`,
//   `defaultValue` and `onValueChange`, which are arrays of open values.
// - `level`: the heading level of the rows, 3 by default.
// - Everything else goes to the SDK's Accordion: `multiple`, `collapsible`,
//   `disabled`, `keepMounted`, `hiddenUntilFound`, `controller`.
//
// A section's height follows the SDK's measured --accordion-panel-height,
// so it opens and closes without the content below jumping.
function Accordion({
  items,
  level = 3,
  ...props
}: Omit<React.ComponentProps<typeof SdkAccordion>, "children"> & {
  items: AccordionSection[]
  level?: 2 | 3 | 4 | 5 | 6
}) {
  const Heading = `h${level}` as "h3"
  return (
    <SdkAccordion data-kit="accordion" {...props}>
      {items.map((item, index) => (
        <AccordionItem key={item.value} value={item.value} disabled={item.disabled} data-kit="accordion-item">
          <AccordionHeader data-kit="accordion-header" render={<Heading />}>
            <AccordionTrigger data-kit="accordion-trigger" data-frame="br" data-press-flash="">
              <span data-kit="accordion-index" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span data-kit="accordion-text">
                <span data-kit="accordion-label">{item.label}</span>
                {item.meta && <span data-kit="accordion-meta">{item.meta}</span>}
              </span>
              <span data-kit="accordion-glyph" aria-hidden />
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel data-kit="accordion-panel">
            <div data-kit="accordion-content">{item.content}</div>
          </AccordionPanel>
        </AccordionItem>
      ))}
    </SdkAccordion>
  )
}

export { Accordion }
export type { AccordionSection }
