import * as React from "react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field"
import {
  Select as SdkSelect,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectItemIndicator,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type ListData,
  type SelectProps,
} from "@ui-sdk/react/select"
import { Check, ChevronDown } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/select.css"

type SelectOption = { value: string; label: string; code?: string; disabled?: boolean }
type SelectOptionGroup = { label: string; options: SelectOption[] }

const isGroup = (entry: SelectOption | SelectOptionGroup): entry is SelectOptionGroup => "options" in entry

// A labelled picker: the trigger sits in the shared control frame, with a
// chevron that turns as the list opens, and the options float in the shared
// popup. An option's `code` (a sector, a serial) prints beside it in the
// list, and beside the chosen value in the trigger, as a readout.
//
// - `options` are flat, or grouped as `{ label, options }`; groups are ruled
//   off from each other.
// - `hint` sits under the control. `error` is the message shown, in yellow,
//   while the field is invalid; pass `invalid` to show it from your own code.
// - Everything else goes to the SDK's Select: `value`, `defaultValue`,
//   `onValueChange`, `name`, `required`, `disabled`, `controller`.
function Select({
  label,
  options,
  hint,
  error,
  invalid,
  placeholder = "Select",
  ...props
}: Omit<Extract<SelectProps<string>, { multiple?: false }>, "children" | "items" | "multiple"> & {
  label: string
  options: (SelectOption | SelectOptionGroup)[]
  hint?: string
  error?: string
  invalid?: boolean
}) {
  const flat = options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry]))
  const codeOf = (value: unknown) => flat.find((option) => option.value === value)?.code

  // The same options as data on the root, so the trigger can show a label,
  // typing can find one, and an agent can read the choices, all before the
  // list has ever opened.
  const items: ListData<string> = options.map((entry) =>
    isGroup(entry)
      ? { type: "group", label: entry.label, items: entry.options.map(({ value, label, disabled }) => ({ value, label, disabled })) }
      : { value: entry.value, label: entry.label, disabled: entry.disabled },
  )

  // A row takes real focus as the keys move, and its highlighted look (the
  // lit fill and the signal bar) is the focus indicator, so it asks for no
  // second ring around it.
  const row = (option: SelectOption) => (
    <SelectItem key={option.value} value={option.value} disabled={option.disabled} data-kit="popup-item" data-focus-quiet="">
      <span data-kit="select-item-text">{option.label}</span>
      {option.code && (
        <span data-kit="select-item-code" aria-hidden>
          {option.code}
        </span>
      )}
      <span data-kit="select-item-mark">
        <SelectItemIndicator data-kit="popup-indicator">
          <Check aria-hidden />
        </SelectItemIndicator>
      </span>
    </SelectItem>
  )

  return (
    <Field data-kit="field" invalid={invalid}>
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <SdkSelect items={items} placeholder={placeholder} {...props}>
        <SelectTrigger data-kit="control" data-frame="br">
          <SelectValue data-kit="select-value">
            {(state) => (
              <>
                <span data-kit="select-value-text">{state.placeholder ? placeholder : state.label}</span>
                {codeOf(state.value) && (
                  <span data-kit="select-value-code" aria-hidden>
                    {codeOf(state.value)}
                  </span>
                )}
              </>
            )}
          </SelectValue>
          <span data-kit="select-chevron" aria-hidden>
            <ChevronDown />
          </span>
        </SelectTrigger>
        <SelectContent data-kit="popup" data-frame="tr bl" sideOffset={4}>
          {options.map((entry, index) =>
            isGroup(entry) ? (
              <React.Fragment key={entry.label}>
                {index > 0 && <SelectSeparator data-kit="popup-separator" />}
                <SelectGroup data-kit="select-group">
                  <SelectGroupLabel data-kit="popup-label">{entry.label}</SelectGroupLabel>
                  {entry.options.map(row)}
                </SelectGroup>
              </React.Fragment>
            ) : (
              row(entry)
            ),
          )}
        </SelectContent>
      </SdkSelect>
      {hint && <FieldDescription data-kit="hint">{hint}</FieldDescription>}
      <FieldError data-kit="field-error" match={invalid ? true : undefined}>
        {error}
      </FieldError>
    </Field>
  )
}

export { Select }
export type { SelectOption, SelectOptionGroup }
