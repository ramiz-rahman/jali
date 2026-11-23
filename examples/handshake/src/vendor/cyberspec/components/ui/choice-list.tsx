import * as React from "react"
import { CornerDownLeft } from "lucide-react"
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio"
import "#src/vendor/cyberspec/components/ui/cyber/choice-list.css"

type Choice<T extends string = string> = {
  value: T
  label: string
  code?: string
  disabled?: boolean
}

// The serial printed beside a reply when it isn't given one: three lines of
// hex that are always the same for the same value, so they don't change
// between renders or between the server and the page.
function serialOf(value: string) {
  let seed = 0x9e37
  for (const char of value) seed = (Math.imul(seed ^ char.charCodeAt(0), 0x45d9f3b) >>> 0) % 0xffffffff
  return Array.from({ length: 3 }, () => {
    seed = (Math.imul(seed, 0x19660d) + 0x3c6ef35f) >>> 0
    const hex = seed.toString(16).toUpperCase().padStart(8, "0")
    return `${hex.slice(0, 4)} ${hex.slice(4)}`
  }).join("\n")
}

// The replies under a message: sentences to answer with, one of which is the
// answer. They read in the signal color off a line down the leading edge,
// and the chosen one is a solid flag-yellow bar with a cut corner.
//
// It's a radio group, and each whole row is its radio: Tab reaches the
// chosen reply, and the arrow keys move the choice, as they would on the
// screen it's modelled on.
//
// - `options` are the replies: a `value`, the sentence as `label`, and
//   optionally the `code` printed beside it (decoration; one is made up
//   from the value otherwise).
// - `hideLabel` keeps the label as the group's name without showing it, for
//   a list that sits directly under the message it answers.
function ChoiceList<T extends string = string>({
  label,
  hideLabel,
  options,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof RadioGroup<T>>, "children"> & {
  label: string
  hideLabel?: boolean
  options: Choice<T>[]
}) {
  const id = React.useId()
  // The chosen reply tears in as it's picked, but not the one that was
  // already chosen when the list appeared.
  const [picked, setPicked] = React.useState(false)
  return (
    <div data-kit="choice-list">
      {!hideLabel && (
        <span data-kit="label" id={id}>
          {label}
        </span>
      )}
      <RadioGroup<T>
        data-kit="choice-list-group"
        data-picked={picked ? "" : undefined}
        aria-label={hideLabel ? label : undefined}
        aria-labelledby={hideLabel ? undefined : id}
        onValueChange={(next, details) => {
          onValueChange?.(next, details)
          if (!details.canceled) setPicked(true)
        }}
        {...props}
      >
        {options.map((option) => (
          <Radio key={option.value} data-kit="choice" data-frame="br" value={option.value} disabled={option.disabled}>
            <span data-kit="choice-code" data-micro aria-hidden>
              {option.code ?? serialOf(option.value)}
            </span>
            <span data-kit="choice-text">{option.label}</span>
            <RadioIndicator data-kit="choice-mark" aria-hidden>
              <CornerDownLeft />
            </RadioIndicator>
          </Radio>
        ))}
      </RadioGroup>
    </div>
  )
}

export { ChoiceList }
export type { Choice }
