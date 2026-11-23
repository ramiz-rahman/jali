import * as React from "react"
import { Progress as SdkProgress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from "@ui-sdk/react/progress"
import "#src/vendor/cyberspec/components/ui/cyber/progress.css"

// A task's progress, as a bar of segments that light one at a time, with the
// percentage read out beside its label in the signal color. The segment
// being worked on breathes, so a slow task still looks alive.
//
// - `value`: how far along, between `min` and `max` (0 to 100 unless set).
//   Leave it out, or pass null, while that isn't known: the bar hatches, a
//   highlight sweeps across it, and `busyLabel` is printed where the
//   percentage would be, so it reads as busy with every effect off too.
// - `variant`: "segments", or "thin" for a hairline bar with its readout
//   underneath, the way a loading screen has it.
// - `segments`: how many steps the bar has.
function Progress({
  label,
  value = null,
  variant = "segments",
  segments = 24,
  busyLabel = "Working",
  getValueLabel,
  style,
  ...props
}: Omit<React.ComponentProps<typeof SdkProgress>, "children" | "value"> & {
  label: string
  value?: number | null
  variant?: "segments" | "thin"
  segments?: number
  busyLabel?: string
}) {
  return (
    <SdkProgress
      data-kit="progress"
      data-variant={variant}
      value={value}
      // The printed readout is hidden from screen readers, which get the
      // value from the bar itself: while it has none, they get the word.
      getValueLabel={getValueLabel ?? ((current, details) => (current == null ? busyLabel : details.formatted))}
      style={(state) => ({ "--segments": segments, ...(typeof style === "function" ? style(state) : style) }) as React.CSSProperties}
      {...props}
    >
      <span data-kit="progress-head">
        <ProgressLabel data-kit="label">{label}</ProgressLabel>
        <ProgressValue data-kit="progress-value">{(state) => state.text || busyLabel}</ProgressValue>
      </span>
      <ProgressTrack data-kit="progress-track">
        <ProgressIndicator data-kit="progress-indicator" />
      </ProgressTrack>
    </SdkProgress>
  )
}

export { Progress }
