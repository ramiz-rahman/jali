"use client"

import * as React from "react"
import { Checkbox as SdkCheckbox, CheckboxGroup as SdkCheckboxGroup, CheckboxIndicator } from "@ui-sdk/react/checkbox"
import "#src/vendor/cyberspec/components/ui/cyber/checkbox.css"

// A cut box beside a line of text, like an objective on a job sheet. Checked,
// it lights and a tick locks on; a partly checked set shows a bar instead.
//
// The row is a label, so the text toggles the box too. `hint` is a second
// line under the text that describes the box without becoming part of its
// name.
function Checkbox({
  label,
  hint,
  ...props
}: Omit<React.ComponentProps<typeof SdkCheckbox>, "children"> & { label: string; hint?: string }) {
  const hintId = React.useId()
  return (
    <div data-kit="checkbox-item">
      <label data-kit="checkbox-row">
        <SdkCheckbox
          data-kit="checkbox"
          data-frame="br"
          data-press-flash=""
          data-parent={props.parent ? "" : undefined}
          aria-describedby={hint ? hintId : undefined}
          {...props}
        >
          <CheckboxIndicator data-kit="checkbox-indicator" aria-hidden />
        </SdkCheckbox>
        <span data-kit="checkbox-label">{label}</span>
      </label>
      {hint && (
        <p data-kit="hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}

// Several boxes that make one value, under a legend. The legend counts what's
// ticked against what's there (the stylesheet does the counting, so it's
// right however the value changes), which a screen reader doesn't need: it
// hears each box's state.
function CheckboxGroup<T extends string = string>({
  label,
  hint,
  children,
  ...props
}: React.ComponentProps<typeof SdkCheckboxGroup<T>> & { label: string; hint?: string }) {
  const id = React.useId()
  return (
    <div data-kit="checkbox-set">
      <div data-kit="checkbox-legend">
        <span data-kit="label" id={`${id}-label`}>
          {label}
        </span>
      </div>
      {hint && (
        <p data-kit="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <SdkCheckboxGroup<T>
        data-kit="checkbox-group"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      >
        {children}
      </SdkCheckboxGroup>
      <span data-kit="checkbox-count" aria-hidden />
    </div>
  )
}

export { Checkbox, CheckboxGroup }
