import * as React from "react"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field"
import {
  Slider as SdkSlider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
  SliderValue,
  type SliderValueChangeDetails,
} from "@ui-sdk/react/slider"
import { crosses, haptic } from "#src/vendor/cyberspec/lib/haptics.ts"
import { createAdjustmentSound, sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import "#src/vendor/cyberspec/components/ui/cyber/slider.css"

// The changes a person makes by hand. A reset, a restore or a controller
// (which is how an agent moves it) changes the value without anyone feeling
// for a detent.
const byHand = new Set(["drag", "track-press", "step-key", "accessibility-adjust"])

// A value on a scale: a thin rail under a row of ticks, a cut block to drag,
// and the reading printed in the signal color. The ticks the value has
// passed light up. Ticking follows movement, and crossing a mark is felt.
//
// - Pass a number for one thumb, or an array for a range: `[20, 80]` gives
//   two thumbs that can't cross, and the reading shows both ends.
// - `ticks` is how many divisions the scale is ruled into (10 by default).
// - `thumbLabels` names each thumb of a range for assistive technology and
//   agents; without it they're "<label> from" and "<label> to".
// - `format` (the SDK's) decides how the reading and each thumb's value are
//   written: `{ style: "unit", unit: "percent" }`, or a function.
function Slider<Value extends number | number[] = number>({
  label,
  hint,
  ticks = 10,
  thumbLabels,
  min = 0,
  max = 100,
  onValueChange,
  onValueCommit,
  ...props
}: Omit<React.ComponentProps<typeof SdkSlider<Value>>, "children"> & {
  label: string
  hint?: string
  ticks?: number
  thumbLabels?: string[]
}) {
  const initial = props.value ?? props.defaultValue
  const count = Array.isArray(initial) ? initial.length : 1
  const detent = (max - min) / Math.max(1, ticks)
  const toList = (value: number | number[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value])
  const last = React.useRef(toList(initial))
  const adjustment = React.useMemo(createAdjustmentSound, [])
  React.useEffect(() => adjustment.stop, [adjustment])
  React.useEffect(() => {
    if (props.disabled || props.readOnly) adjustment.stop()
  }, [adjustment, props.disabled, props.readOnly])
  React.useEffect(() => {
    if (props.value !== undefined) last.current = toList(props.value)
  }, [props.value])

  const change = (next: Value, details: SliderValueChangeDetails) => {
    onValueChange?.(next, details)
    if (details.canceled) return adjustment.stop()
    const list = toList(next)
    const before = last.current
    last.current = list
    if (!byHand.has(details.reason)) return adjustment.stop()
    if (details.reason === "drag") adjustment.move()
    else {
      adjustment.stop()
      // Discrete keys, track presses and accessibility adjustments may
      // commit immediately. Give each one a complete recorded tick.
      sfx("hover")
    }
    if (list.some((value, index) => crosses((before[index] ?? value) - min, value - min, detent))) {
      haptic("selection")
    }
  }

  // One mark per division, plus the one that closes the scale.
  const marks = Array.from({ length: Math.max(1, ticks) + 1 }, (_, index) => <span key={index} />)
  const nameOf = (index: number) => thumbLabels?.[index] ?? (count === 2 ? `${label} ${index ? "to" : "from"}` : `${label} ${index + 1}`)

  return (
    <Field data-kit="field">
      <SdkSlider<Value>
        data-kit="slider"
        data-range={count > 1 ? "" : undefined}
        min={min}
        max={max}
        onValueChange={change}
        {...props}
        onValueCommit={(value, details) => {
          adjustment.stop()
          onValueCommit?.(value, details)
        }}
        onBlur={(event) => {
          adjustment.stop()
          props.onBlur?.(event)
        }}
        onPointerCancel={(event) => {
          adjustment.stop()
          props.onPointerCancel?.(event)
        }}
        onLostPointerCapture={(event) => {
          adjustment.stop()
          props.onLostPointerCapture?.(event)
        }}
      >
        <div data-kit="slider-head">
          <FieldLabel data-kit="label">{label}</FieldLabel>
          <SliderValue data-kit="slider-value" />
        </div>
        <SliderControl data-kit="slider-control">
          <SliderTrack data-kit="slider-track">
            <span data-kit="slider-scale" aria-hidden>
              {marks}
            </span>
            {/* The same scale again, lit, inside the filled part: the
                indicator shows only as much of it as the value has passed. */}
            <SliderIndicator data-kit="slider-indicator">
              <span data-kit="slider-scale" data-lit="" aria-hidden>
                {marks}
              </span>
            </SliderIndicator>
            {count > 1 ? (
              Array.from({ length: count }, (_, index) => (
                <SliderThumb key={index} data-kit="slider-thumb" index={index} aria-label={nameOf(index)} />
              ))
            ) : (
              <SliderThumb data-kit="slider-thumb" />
            )}
          </SliderTrack>
        </SliderControl>
      </SdkSlider>
      {hint && <FieldDescription data-kit="hint">{hint}</FieldDescription>}
    </Field>
  )
}

export { Slider }
