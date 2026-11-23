"use client"

import * as React from "react"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import {
  SegmentedControl as SdkSegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import "#src/vendor/cyberspec/components/ui/cyber/segmented-control.css"

type Segment<T extends string = string> = {
  value: T
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

// A switch with more than two positions: a cut track, and a lit block that
// snaps across it to the chosen segment. It's a radio group underneath, so
// it has one tab stop and the arrow keys move the choice.
//
// - `options` are the segments. A bare string is both the value and the
//   label; an object can add an `icon` or be `disabled`.
// - `iconOnly` shows only the icons. Every option still needs its `label`,
//   which becomes the segment's name.
// - `fill` stretches the track across its container, in equal segments.
function SegmentedControl<T extends string = string>({
  label,
  hint,
  options,
  iconOnly,
  fill,
  ...props
}: Omit<React.ComponentProps<typeof SdkSegmentedControl<T>>, "children"> & {
  label: string
  hint?: string
  options: (T | Segment<T>)[]
  iconOnly?: boolean
  fill?: boolean
}) {
  return (
    <Field data-kit="field">
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <SdkSegmentedControl<T>
        data-kit="segmented-control"
        data-frame="tl br"
        data-fill={fill ? "" : undefined}
        data-icon-only={iconOnly ? "" : undefined}
        {...props}
      >
        <SegmentedControlIndicator data-kit="segmented-control-indicator" data-frame="tl br" />
        {options.map((entry) => {
          const option: Segment<T> = typeof entry === "string" ? { value: entry, label: entry } : entry
          return (
            <SegmentedControlItem
              key={option.value}
              data-kit="segmented-control-item"
              data-press-flash=""
              value={option.value}
              disabled={option.disabled}
              aria-label={iconOnly ? option.label : undefined}
            >
              {option.icon && (
                <span data-kit="segmented-control-icon" aria-hidden>
                  {option.icon}
                </span>
              )}
              {!iconOnly && option.label}
            </SegmentedControlItem>
          )
        })}
      </SdkSegmentedControl>
      {hint && <FieldDescription data-kit="hint">{hint}</FieldDescription>}
    </Field>
  )
}

export { SegmentedControl }
export type { Segment }
