"use client"

import * as React from "react"
import { bindRepeat } from "@ui-sdk/core"
import { Button as SdkButton } from "@ui-sdk/react/button"
import { haptic } from "#src/vendor/cyberspec/lib/haptics.ts"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import type { ButtonSize, ButtonTone } from "#src/vendor/cyberspec/components/ui/button.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/button.css"
import "#src/vendor/cyberspec/components/ui/cyber/button-group.css"

type GroupKey = {
  /** The key's name. It's also what the key shows, unless `icon` or `content` draws something else. */
  label: string
  /** One icon, on a square key. */
  icon?: React.ReactNode
  /** Anything else to show in place of the label, like a readout. Keep any text it shows in `label` too. */
  content?: React.ReactNode
  /** Return `false` when nothing changes; this also stops a repeating hold. */
  onPress?: () => boolean | void
  /** A value-changing key's direction, independent of its label or icon. */
  action?: "increment" | "decrement"
  /** Keeps stepping while held: once on the press, then every 80ms after 380ms. */
  repeat?: boolean
  disabled?: boolean
}

// The cuts of a strip sit on its far side: under a row, and at the trailing
// ends of a column. A key on its own is cut like any other key.
function frameAt(index: number, count: number, vertical: boolean) {
  if (count === 1) return "notch br"
  if (index === 0) return vertical ? "tl" : "bl"
  return index === count - 1 ? "br" : "mid"
}

type KeyProps = { spec: GroupKey; frame: string; tone: ButtonTone; size: ButtonSize }

const face = (spec: GroupKey) => spec.icon ?? spec.content ?? spec.label
const named = (spec: GroupKey) => (spec.icon != null || spec.content != null ? spec.label : undefined)

function Key({ spec, frame, tone, size }: KeyProps) {
  return (
    <SdkButton
      data-kit="button"
      data-frame={frame}
      data-press-flash=""
      data-tone={tone}
      data-size={size}
      data-icon={spec.icon != null ? "" : undefined}
      data-sfx={spec.action ? "none" : undefined}
      aria-label={named(spec)}
      disabled={spec.disabled}
      onClick={() => {
        if (spec.disabled || !spec.onPress) return
        if (spec.onPress() !== false && spec.action) sfx(spec.action)
      }}
    >
      {face(spec)}
    </SdkButton>
  )
}

// A key that keeps stepping while it's held, through core's bindRepeat. It
// sounds for every accepted step, so it silences the page's own press sound, and the
// marks in its corner light while it runs. It stays focusable when disabled:
// a stepper that reaches its bound mustn't drop the focus that got it there.
function RepeatKey({ spec, frame, tone, size }: KeyProps) {
  const el = React.useRef<HTMLButtonElement>(null)
  const latest = React.useRef(spec)
  React.useLayoutEffect(() => {
    latest.current = spec
  })
  React.useEffect(() => {
    const node = el.current
    if (!node) return
    const rest = () => node.removeAttribute("data-repeating")
    const unbind = bindRepeat(node, {
      delay: 380,
      repeat: 80,
      // Keys are left to the button: one press each, repeating as the
      // keyboard does.
      keys: [],
      disabled: () => Boolean(latest.current.disabled),
      onStep: ({ count }) => {
        const current = latest.current
        if (current.disabled || !current.onPress || current.onPress() === false) return false
        sfx(current.action ?? "tick")
        if (count > 1) {
          haptic("selection")
          node.setAttribute("data-repeating", "")
        }
      },
      onEnd: rest,
    })
    return () => {
      unbind()
      rest()
    }
  }, [])

  return (
    <SdkButton
      ref={el}
      data-kit="button"
      data-frame={frame}
      data-press-flash=""
      data-tone={tone}
      data-size={size}
      data-icon={spec.icon != null ? "" : undefined}
      data-sfx="none"
      aria-label={named(spec)}
      disabled={spec.disabled}
      focusableWhenDisabled
    >
      {face(spec)}
      <span data-kit="button-group-repeat" aria-hidden />
    </SdkButton>
  )
}

// Keys joined into one strip, each sharing an edge with the next: the minus,
// readout and plus of a stepper, or a pair of answers. Every cell is still
// its own button.
//
// - `label` names the strip for assistive technology.
// - `keys` are its cells. One marked `repeat` keeps firing while held, for
//   nudging a value, and carries three marks in its corner to say so.
// - `orientation="vertical"` stacks them.
function ButtonGroup({
  label,
  keys,
  orientation = "horizontal",
  tone = "secondary",
  size = "md",
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "role"> & {
  label: string
  keys: GroupKey[]
  orientation?: "horizontal" | "vertical"
  tone?: ButtonTone
  size?: ButtonSize
}) {
  return (
    <div data-kit="button-group" data-orientation={orientation} role="group" aria-label={label} {...props}>
      {keys.map((spec, index) => {
        const Cell = spec.repeat ? RepeatKey : Key
        return <Cell key={index} spec={spec} frame={frameAt(index, keys.length, orientation === "vertical")} tone={tone} size={size} />
      })}
    </div>
  )
}

export { ButtonGroup }
export type { GroupKey }
