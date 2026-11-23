import * as React from "react"
import { fxLevel, onFxChange, type FxLevel } from "#src/vendor/cyberspec/lib/fx.ts"
import { installCyber } from "#src/vendor/cyberspec/lib/install.ts"
import "#src/vendor/cyberspec/components/ui/cyber/skin.css"

// Installed as this module loads rather than in an effect: the observer
// behind the agent signal has to be listening before components are created.
installCyber()

type Accent = { l: number; c: number; h: number }

// The root of the cyber skin. Everything inside it is styled by the skin.
//
// - `accent` is the theme color as an OKLCH lightness, chroma and hue;
//   without it the kit is its default red.
// - `theme="monochrome"` sets the whole palette to grayscale.
// - `fx` pins the FX level for this root ("full", "calm" or "off"). Leave it
//   out to follow the person's choice, and the system's reduced-motion
//   setting before they've made one.
function Cyber({
  accent,
  theme,
  fx,
  style,
  ...props
}: React.ComponentProps<"div"> & { accent?: Accent; theme?: "monochrome"; fx?: FxLevel }) {
  const level = React.useSyncExternalStore(
    onFxChange,
    fxLevel,
    // On the server the level isn't known; the stylesheet falls back to the
    // system setting until the page hydrates.
    () => undefined,
  )
  const accentStyle = accent && ({ "--theme-l": accent.l, "--theme-c": accent.c, "--theme-h": accent.h } as React.CSSProperties)
  return <div data-skin="cyber" data-theme={theme} data-fx={fx ?? level} data-fx-pinned={fx ? "" : undefined} style={{ ...accentStyle, ...style }} {...props} />
}

export { Cyber }
export type { Accent }
