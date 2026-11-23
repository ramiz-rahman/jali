"use client"

import * as React from "react"
import { Switch as SdkSwitch, SwitchThumb } from "@ui-sdk/react/switch"
import "#src/vendor/cyberspec/components/ui/cyber/switch.css"

// A two-state latch: a block that slides across a cut track and lights when
// it lands. The row is a label, so the text toggles it too, and its state is
// printed beside it (ON or OFF) so it never rests on color alone.
function Switch({
  label,
  ...props
}: Omit<React.ComponentProps<typeof SdkSwitch>, "children"> & { label: string }) {
  return (
    <label data-kit="switch-row">
      <span data-kit="label">{label}</span>
      <SdkSwitch data-kit="switch" data-frame="tl br" {...props}>
        <SwitchThumb data-kit="switch-thumb" data-frame="tl br" />
        <span data-kit="switch-state" aria-hidden />
      </SdkSwitch>
    </label>
  )
}

export { Switch }
