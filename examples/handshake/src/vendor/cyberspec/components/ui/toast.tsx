"use client"

import * as React from "react"
import { Button, type ButtonTone } from "#src/vendor/cyberspec/components/ui/button.tsx"
import { notify, type NotifyOptions, type ToastTone } from "#src/vendor/cyberspec/components/ui/toaster.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/toast.css"

type Sample = {
  /** What the key says. */
  label: string
  title: string
} & Pick<NotifyOptions, "tone" | "description" | "action">

// The key that raises a tone wears the nearest thing a key has to it.
const keyTone: Record<ToastTone, ButtonTone> = { info: "signal", success: "secondary", warning: "flag", error: "primary" }

const samples: Sample[] = [
  { label: "Info", tone: "info", title: "Incoming job", description: "Mara Voss posted a courier run out of Lowtide.", action: { label: "Open", onAction: () => {} } },
  { label: "Success", tone: "success", title: "Route cleared", description: "Glasswater checkpoint is behind you." },
  { label: "Warning", tone: "warning", title: "Trace at 60%", description: "Vanta ICE is closing on NODE 3F:A2." },
  { label: "Error", tone: "error", title: "Uplink lost", description: "No signal from the relay." },
]

// A row of keys that each raise one toast, for trying the tones out: the
// toast itself is drawn by <Toasts /> (toaster.tsx), which has to be mounted
// somewhere on the page, and anything can raise one with `notify()`.
//
// - `samples` replaces the four it comes with: a label for the key, a title, and
//   notify's tone, description and action.
function ToastKeys({ samples: list = samples, ...props }: Omit<React.ComponentProps<"div">, "children"> & { samples?: Sample[] }) {
  return (
    <div data-kit="toast-keys" role="group" aria-label="Raise a notification" {...props}>
      {list.map(({ label, title, ...options }) => (
        // The toast makes its own sound as it arrives, so the key keeps
        // quiet.
        <Button key={label} tone={keyTone[options.tone ?? "info"]} data-sfx="none" onClick={() => void notify(title, options)}>
          {label}
        </Button>
      ))}
    </div>
  )
}

export { ToastKeys }
export type { Sample as ToastSample }
