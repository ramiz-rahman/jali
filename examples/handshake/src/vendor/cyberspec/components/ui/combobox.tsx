import * as React from "react"
import {
  Combobox as SdkCombobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemText,
  ComboboxList,
  ComboboxStatus,
  ComboboxTrigger,
  type ComboboxProps,
} from "@ui-sdk/react/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field"
import { Check, ChevronDown, Search, X } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/combobox.css"

type ComboboxOption = { value: string; label: string; meta?: string; keywords?: string[]; disabled?: boolean }

// A search field over a list: type to narrow it, and the letters that
// matched light in the signal color. The popup's heading counts what's left
// and says so to a screen reader; when nothing is, it says that instead.
//
// - `options`: each a `value` and a `label`, with an optional `meta` printed
//   beside it (a role, a unit) that typing matches too.
// - `empty` is the line shown when nothing matches.
// - `hint`, `error` and `invalid` work as they do on Select.
// - Everything else goes to the SDK's Combobox: `value`, `defaultValue`,
//   `onValueChange`, `name`, `required`, `disabled`, `autoHighlight`.
function Combobox({
  label,
  options,
  placeholder = "Search",
  empty = "No match.",
  hint,
  error,
  invalid,
  ...props
}: Omit<Extract<ComboboxProps<string>, { multiple?: false }>, "children" | "items" | "multiple"> & {
  label: string
  options: ComboboxOption[]
  placeholder?: string
  empty?: string
  hint?: string
  error?: string
  invalid?: boolean
}) {
  // The popup hangs from the whole framed control, not the bare input in it.
  const [control, setControl] = React.useState<HTMLDivElement | null>(null)
  const byValue = new Map(options.map((option) => [option.value, option]))

  // The options as data on the root: the SDK filters them without rendering
  // every row, and an agent can read the choices while the list is closed.
  const items = options.map(({ value, label, meta, keywords, disabled }) => ({
    value,
    label,
    keywords: meta ? [meta, ...(keywords ?? [])] : keywords,
    disabled,
  }))

  return (
    <Field data-kit="field" invalid={invalid}>
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <SdkCombobox items={items} autoHighlight {...props}>
        <div ref={setControl} data-kit="control" data-frame="br" data-frame-focus="within">
          <span data-kit="control-icon" aria-hidden>
            <Search />
          </span>
          {/* The frame lights for whichever of these has focus, so none of
              them draws a ring of its own. */}
          <ComboboxInput placeholder={placeholder} data-focus-quiet="" />
          <ComboboxClear data-kit="combobox-clear" data-focus-quiet="" aria-label={`Clear ${label}`}>
            <X aria-hidden />
          </ComboboxClear>
          <ComboboxTrigger data-kit="combobox-trigger" data-focus-quiet="" aria-label={`Show ${label} options`}>
            <ChevronDown aria-hidden />
          </ComboboxTrigger>
        </div>
        <ComboboxContent data-kit="popup" data-frame="tr bl" anchor={control} sideOffset={4}>
          <ComboboxStatus data-kit="combobox-status">
            {(state) =>
              state.count > 0 && (
                <>
                  <span data-kit="value">{state.count}</span> {state.count === 1 ? "match" : "matches"}
                </>
              )
            }
          </ComboboxStatus>
          {/* The empty part is a live region that stays in the popup, so the
              padded line goes inside it and takes no room until it shows. */}
          <ComboboxEmpty data-kit="combobox-empty">
            <div data-kit="popup-empty">{empty}</div>
          </ComboboxEmpty>
          <ComboboxList data-kit="combobox-list">
            {(state) =>
              state.items.map((entry) => {
                // Only plain items are passed in, so anything else here is
                // not ours to draw.
                const option = typeof entry === "object" && "value" in entry ? byValue.get(String(entry.value)) : undefined
                if (!option) return null
                return (
                  <ComboboxItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    disabled={option.disabled}
                    data-kit="popup-item"
                    data-focus-quiet=""
                  >
                    <ComboboxItemText data-kit="combobox-item-text">
                      {(text) =>
                        text.segments.map((segment, index) =>
                          segment.match ? (
                            <mark key={index} data-kit="combobox-match">
                              {segment.text}
                            </mark>
                          ) : (
                            segment.text
                          ),
                        )
                      }
                    </ComboboxItemText>
                    {option.meta && <span data-kit="combobox-item-meta">{option.meta}</span>}
                    <span data-kit="combobox-item-mark">
                      <ComboboxItemIndicator data-kit="popup-indicator">
                        <Check aria-hidden />
                      </ComboboxItemIndicator>
                    </span>
                  </ComboboxItem>
                )
              })
            }
          </ComboboxList>
        </ComboboxContent>
      </SdkCombobox>
      {hint && <FieldDescription data-kit="hint">{hint}</FieldDescription>}
      <FieldError data-kit="field-error" match={invalid ? true : undefined}>
        {error}
      </FieldError>
    </Field>
  )
}

export { Combobox }
export type { ComboboxOption }
