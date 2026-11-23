"use client"

import * as React from "react"
import { Meter as SdkMeter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from "@ui-sdk/react/meter"
import "#src/vendor/cyberspec/components/ui/cyber/meter.css"

type Status = "low" | "high"

// A gauge: a measurement inside a known range, as a bar of segments with the
// reading beside its label. Where a progress bar is a task and burns in the
// accent, a gauge is a value, so it reads in the signal color.
//
// - `value`, `min`, `max`: the reading and its range (0 to 100 unless set).
// - `low` and `high` are thresholds. At or under `low` the fill turns yellow
//   and LOW is printed; at or over `high` it burns in the accent on a lit
//   track and CRIT is printed. The zones are tinted on the track before the
//   reading reaches them, like a redline, with a tick under each threshold.
// - `lowLabel` and `highLabel` replace those words.
// - `format`: without one the readout is the reading over the top of the
//   range, "10/50". Pass Intl.NumberFormat options or a function of the value
//   for a unit or a percentage, and the readout is that text alone.
// - `segments`: how many steps the bar has.
function Meter({
  label,
  value,
  min = 0,
  max = 100,
  low,
  high,
  lowLabel = "Low",
  highLabel = "Crit",
  segments = 20,
  format,
  getValueLabel,
  style,
  ...props
}: Omit<React.ComponentProps<typeof SdkMeter>, "children"> & {
  label: string
  low?: number
  high?: number
  lowLabel?: string
  highLabel?: string
  segments?: number
}) {
  const status: Status | undefined = high != null && value >= high ? "high" : low != null && value <= low ? "low" : undefined
  const word = status === "high" ? highLabel : status === "low" ? lowLabel : undefined
  const fraction = format == null
  // Where a threshold sits along the track, as a percentage of the range.
  const at = (point: number) => `${Math.min(100, Math.max(0, ((point - min) / (max - min || 1)) * 100))}%`
  const marks = { "--segments": segments, "--low": low != null ? at(low) : undefined, "--high": high != null ? at(high) : undefined }

  return (
    <SdkMeter
      data-kit="meter"
      data-status={status}
      value={value}
      min={min}
      max={max}
      format={format ?? { style: "decimal" }}
      // The printed readout is hidden from screen readers, which get the
      // reading from the gauge itself: the range and the word go in there too.
      getValueLabel={
        getValueLabel ??
        ((current, details) => [fraction ? `${details.formatted} of ${details.max}` : details.formatted, word].filter(Boolean).join(", "))
      }
      style={(state) => ({ ...marks, ...(typeof style === "function" ? style(state) : style) }) as React.CSSProperties}
      {...props}
    >
      <span data-kit="meter-head">
        <MeterLabel data-kit="label">{label}</MeterLabel>
        {word && <span data-kit="meter-status">{word}</span>}
        <MeterValue data-kit="meter-value">
          {(state) => (
            <>
              {state.text}
              {fraction && <span data-kit="meter-max">/{max}</span>}
            </>
          )}
        </MeterValue>
      </span>
      <MeterTrack data-kit="meter-track">
        <MeterIndicator data-kit="meter-indicator" />
      </MeterTrack>
      {(low != null || high != null) && (
        <span data-kit="meter-scale" aria-hidden>
          {low != null && <span data-kit="meter-tick" data-at="low" data-passed={value <= low ? "" : undefined} />}
          {high != null && <span data-kit="meter-tick" data-at="high" data-passed={value >= high ? "" : undefined} />}
        </span>
      )}
    </SdkMeter>
  )
}

export { Meter }
