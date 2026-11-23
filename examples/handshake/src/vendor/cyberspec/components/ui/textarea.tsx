import * as React from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field"
import { Textarea as SdkTextarea } from "@ui-sdk/react/textarea"
import "#src/vendor/cyberspec/components/ui/cyber/textarea.css"

// Several lines of text in the kit's field box. It grows with what's typed
// until it reaches its tallest, then scrolls.
//
// With `maxLength`, a readout beside the label counts the characters used.
// It turns to the flag color over the last tenth, and prints MAX at the
// limit. A screen reader hears the count when focus arrives, and is told
// once when the text is nearly full and once when it's full, not on every
// key.
//
// - `hint` describes the field; `error` marks it invalid with a message.
// - `rows` is its shortest, three lines by default. `autoResize` is on;
//   pass `autoResize={false}` for a fixed box with a drag handle.
//
// Everything else goes to the textarea: `value`, `onValueChange`, `rows`,
// `submitShortcut`, a `controller`.
function Textarea({
  label,
  hint,
  error,
  disabled,
  maxLength,
  value,
  defaultValue,
  onValueChange,
  autoResize = true,
  rows = 3,
  ...props
}: React.ComponentProps<typeof SdkTextarea> & {
  label: string
  hint?: React.ReactNode
  error?: string
}) {
  // The count has to follow typing, a reset, a controller and an agent
  // alike, so it's kept from the change callback, which hears all four.
  // It describes the textarea through aria-describedby, which the field
  // merges with its own: a field keeps only one FieldDescription, and that
  // one is the hint.
  const [typed, setTyped] = React.useState(() => (defaultValue ?? "").length)
  const used = value != null ? value.length : typed
  const countId = React.useId()

  const left = maxLength != null ? Math.max(0, maxLength - used) : null
  const nearAt = maxLength != null ? Math.max(1, Math.round(maxLength / 10)) : 0
  const full = left === 0
  const near = left != null && left <= nearAt

  return (
    <Field data-kit="field" disabled={disabled} invalid={error ? true : undefined}>
      <div data-kit="textarea-head">
        <FieldLabel data-kit="label">{label}</FieldLabel>
        {maxLength != null && (
          <span id={countId} data-kit="textarea-count" data-near={near ? "" : undefined} data-full={full ? "" : undefined}>
            {full && (
              <span data-kit="textarea-tag" aria-hidden>
                MAX
              </span>
            )}
            <span aria-hidden>
              {String(used).padStart(String(maxLength).length, "0")}/{maxLength}
            </span>
            <span data-sr-only>
              {used} of {maxLength} characters used
            </span>
          </span>
        )}
      </div>
      <div data-kit="control" data-frame="br" data-frame-focus="within">
        <span data-kit="textarea-tick" aria-hidden />
        <SdkTextarea
          data-kit="textarea"
          data-grow={autoResize ? "" : undefined}
          autoResize={autoResize}
          rows={rows}
          style={{ "--rows": rows } as React.CSSProperties}
          maxLength={maxLength}
          aria-describedby={maxLength != null ? countId : undefined}
          value={value}
          defaultValue={defaultValue}
          onValueChange={(next, details) => {
            onValueChange?.(next, details)
            if (!details.canceled) setTyped(next.length)
          }}
          {...props}
        />
      </div>
      {maxLength != null && (
        <span data-sr-only role="status">
          {full ? "Character limit reached." : near ? `${nearAt} characters or fewer left.` : ""}
        </span>
      )}
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

export { Textarea }
