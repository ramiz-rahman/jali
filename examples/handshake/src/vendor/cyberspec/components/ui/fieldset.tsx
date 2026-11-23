"use client"

import * as React from "react"
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@ui-sdk/react/field"
import "#src/vendor/cyberspec/components/ui/cyber/fieldset.css"

// A group of fields under one name: a spined frame with the legend at its
// head and a line of micro-print along its foot. The frame comes up a step
// while focus is inside it, so in a long form the group being worked on is
// the lit one.
//
// It's a native fieldset, so the legend names the group for a screen reader
// and `disabled` switches off every control inside at once; the frame then
// prints LOCKED beside the legend.
//
// - `legend` names the group; `description` says what it's for and is read
//   as focus enters.
// - `code` is the micro-print. Decoration only.
// - `children` are the fields. Where there's room, fields sit two abreast;
//   anything that isn't a field (a switch's row, a row of keys) takes the
//   full width.
function Fieldset({
  legend,
  description,
  code = "NODE 3F:A2 // REV 0.1",
  children,
  ...props
}: Omit<React.ComponentProps<typeof FieldSet>, "children"> & {
  legend: string
  description?: React.ReactNode
  code?: string
  children: React.ReactNode
}) {
  return (
    <FieldSet data-kit="fieldset" data-frame="spine br" {...props}>
      <FieldLegend data-kit="fieldset-legend">
        {legend}
        <span data-kit="fieldset-lock" aria-hidden>
          LOCKED
        </span>
      </FieldLegend>
      <div data-kit="fieldset-body">
        {description && <FieldDescription data-kit="hint">{description}</FieldDescription>}
        <FieldGroup data-kit="fieldset-group">{children}</FieldGroup>
        <span data-micro aria-hidden>
          {code}
        </span>
      </div>
    </FieldSet>
  )
}

export { Fieldset }
