import * as React from "react"
import { ToggleGroup as SdkToggleGroup } from "@ui-sdk/react/toggle"
import { Toggle, type ToggleSize } from "#src/vendor/cyberspec/components/ui/toggle.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/toggle-group.css"

type ToggleOption<T extends string = string> = {
  value: T
  label: string
  icon?: React.ReactNode
  /** Shows only the icon; the label becomes the key's name. */
  iconOnly?: boolean
  disabled?: boolean
}

// The cuts of a strip sit on its far side: under a row, and at the two ends
// of a column.
function frameAt(index: number, count: number, vertical: boolean) {
  if (count === 1) return "notch br"
  if (index === 0) return vertical ? "tl" : "bl"
  return index === count - 1 ? "br" : "mid"
}

const two = (n: number) => String(n).padStart(2, "0")

// Toggles in one strip, sharing one value: the modes of a weapon, the layers
// of a scan. One tab stop; the arrow keys move along it, and Space or Enter
// presses.
//
// - `label` is printed over the strip and names the group.
// - By default one option is pressed at a time, and pressing it again
//   clears it; `deselectable={false}` keeps one pressed.
// - `multiple` lets several stay pressed, and prints how many are (02/04)
//   beside the label.
// - `orientation="vertical"` stacks the options as rows.
//
// The value is always an array, as ui-sdk's ToggleGroup has it; the rest of
// its props (`value`, `defaultValue`, `onValueChange`, `disabled`, `loop`,
// `controller`) pass through.
function ToggleGroup<T extends string = string>({
  label,
  options,
  size = "md",
  multiple,
  orientation,
  ...props
}: Omit<React.ComponentProps<typeof SdkToggleGroup<T>>, "children"> & {
  label: string
  options: ToggleOption<T>[]
  size?: ToggleSize
}) {
  const id = React.useId()
  const vertical = orientation === "vertical"
  return (
    <SdkToggleGroup<T> data-kit="toggle-group" aria-labelledby={id} multiple={multiple} orientation={orientation} {...props}>
      {(state) => (
        <>
          <span id={id} data-kit="toggle-group-label">
            {label}
          </span>
          {/* Decoration: each toggle already says whether it's pressed. */}
          {multiple && (
            <span data-kit="toggle-group-count" aria-hidden>
              {two(state.value.length)}/{two(options.length)}
            </span>
          )}
          <div data-kit="toggle-group-keys">
            {options.map((option, index) => (
              <Toggle
                key={option.value}
                value={option.value}
                size={size}
                icon={option.icon}
                disabled={option.disabled}
                aria-label={option.iconOnly ? option.label : undefined}
                data-frame={frameAt(index, options.length, vertical)}
                data-joined=""
              >
                {option.iconOnly ? undefined : option.label}
              </Toggle>
            ))}
          </div>
        </>
      )}
    </SdkToggleGroup>
  )
}

export { ToggleGroup }
export type { ToggleOption }
