import * as React from "react"
import { Toggle as SdkToggle, ToggleIcon } from "@ui-sdk/react/toggle"
import { playCipherText } from "#src/vendor/cyberspec/lib/cipher.ts"
import "#src/vendor/cyberspec/components/ui/cyber/toggle.css"

type Size = "sm" | "md"

function ToggleLabelEffect({ lamp, pressed, disabled }: {
  lamp: React.RefObject<HTMLSpanElement | null>
  pressed: boolean
  disabled: boolean
}) {
  const wasPressed = React.useRef(pressed)
  React.useLayoutEffect(() => {
    const turnedOn = pressed && !wasPressed.current
    wasPressed.current = pressed
    const toggle = lamp.current?.parentElement
    if (turnedOn && !disabled && toggle) return playCipherText(toggle)
  }, [lamp, pressed, disabled])
  return null
}

// A latching key: press it and it stays lit until it's pressed again. It's
// cut like a Button, with a lamp in its far corner that's hollow while off
// and solid while on, so the state never rests on the fill alone.
//
// - `icon` goes before the label. With no label the key is square, and
//   needs an aria-label.
// - Keep the label the same in both states: "Silent mode", not "Unmute".
//   Assistive technology announces whether it's pressed.
//
// The rest goes to ui-sdk's Toggle: `pressed`, `defaultPressed`,
// `onPressedChange`, `disabled`, `controller`, and `value` inside a group.
function Toggle({
  size = "md",
  icon,
  mirror,
  cipher = false,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkToggle>, "children" | "render"> & {
  size?: Size
  icon?: React.ReactNode
  /** Flips the icon in right-to-left text, for one that points a way. */
  mirror?: boolean
  /** Decode the label once when the toggle switches on at full FX. */
  cipher?: boolean
  children?: React.ReactNode
}) {
  const lamp = React.useRef<HTMLSpanElement>(null)
  return (
    <SdkToggle
      data-kit="toggle"
      data-frame="notch br"
      data-press-flash=""
      data-size={size}
      data-icon-only={icon != null && children == null ? "" : undefined}
      {...props}
      // The page plays a sound for every press from what was pressed. This
      // one is a latch, so it says which way it's about to go: the click is
      // heard before the state changes.
      render={(part, state) => <button {...part} data-sfx={state.pressed ? "off" : "on"} />}
    >
      {state => <>
        {icon != null && (
          <ToggleIcon data-kit="toggle-icon" data-cipher-ignore={cipher ? "" : undefined} mirror={mirror}>
            {icon}
          </ToggleIcon>
        )}
        {children}
        <span ref={lamp} data-kit="toggle-lamp" aria-hidden />
        {cipher && children != null && <ToggleLabelEffect lamp={lamp} pressed={state.pressed} disabled={state.disabled} />}
      </>}
    </SdkToggle>
  )
}

export { Toggle }
export type { Size as ToggleSize }
