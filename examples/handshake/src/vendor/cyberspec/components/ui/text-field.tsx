"use client"

import * as React from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field"
import { Input, InputClear, InputGroup } from "@ui-sdk/react/input"
import { X } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/text-field.css"

// One line of text in the kit's field box: a label, the framed input, and a
// hint or an error under it. A tick on the box's leading edge lights in the
// signal color while the field holds anything.
//
// - `hint` describes the field; `error` marks it invalid and replaces the
//   browser's own message. Without `error`, native constraints (`required`,
//   `pattern`, `type="email"`) still report under the field after a submit.
// - `icon` and `prefix` sit before the text, `suffix` after it. They're
//   display only: pressing them focuses the input.
// - `clearable` adds a key that empties the field while it has text.
//
// Everything else goes to the input, so `value`, `onValueChange`, `name` and
// a `controller` work as they do on the SDK's own.
function Group({ clearable, label, children }: { clearable?: boolean; label: string; children: React.ReactNode }) {
  const frame = { "data-kit": "control", "data-frame": "br", "data-frame-focus": "within" }
  if (!clearable) return <div {...frame}>{children}</div>
  return (
    <InputGroup {...frame} role="group" aria-label={`${label} field`}>
      {children}
    </InputGroup>
  )
}

function TextField({
  label,
  hint,
  error,
  icon,
  prefix,
  suffix,
  clearable,
  disabled,
  required,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "prefix"> & {
  label: string
  hint?: React.ReactNode
  error?: string
  icon?: React.ReactNode
  prefix?: string
  suffix?: string
  clearable?: boolean
}) {
  return (
    <Field data-kit="field" disabled={disabled} invalid={error ? true : undefined}>
      <div data-kit="text-field-head">
        <FieldLabel data-kit="label">{label}</FieldLabel>
        {required && (
          <span data-kit="text-field-tag" aria-hidden>
            REQ
          </span>
        )}
      </div>
      {/* The group part exists for the clear key. It registers with the agent
          bridge as a component of its own, so it's only used when there is a
          clear key for it to offer, and then it's named. */}
      <Group clearable={clearable} label={label}>
        <span data-kit="text-field-tick" aria-hidden />
        {icon && (
          <span data-kit="control-icon" aria-hidden>
            {icon}
          </span>
        )}
        {prefix && <span data-kit="control-icon">{prefix}</span>}
        <Input data-kit="text-field" spellCheck={false} required={required} {...props} />
        {suffix && <span data-kit="control-icon">{suffix}</span>}
        {clearable && (
          <InputClear data-kit="text-field-clear" data-frame="br" data-press-flash="" aria-label={`Clear ${label}`}>
            <X aria-hidden />
          </InputClear>
        )}
      </Group>
      {hint && <FieldDescription data-kit="hint">{hint}</FieldDescription>}
      {error ? (
        <FieldError data-kit="field-error" match>
          {error}
        </FieldError>
      ) : (
        <FieldError data-kit="field-error" />
      )}
    </Field>
  )
}

export { TextField }
