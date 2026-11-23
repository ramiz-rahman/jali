import { installAgentSignal } from "#src/vendor/cyberspec/lib/agent-signal.ts"
import { installFx } from "#src/vendor/cyberspec/lib/fx.ts"
import { installHaptics } from "#src/vendor/cyberspec/lib/haptics.ts"
import { installInputModality } from "#src/vendor/cyberspec/lib/input-modality.ts"
import { installSound } from "#src/vendor/cyberspec/lib/sound.ts"

// The page-wide behaviors the skin relies on: the FX level, interface sounds,
// haptics, keyboard-or-pointer focus tracking, and the signal shown when an
// agent changes something. Each listens at the document, so they're
// installed once, however many <Cyber> roots there are.
let installed = false

function installCyber() {
  if (installed || typeof document === "undefined") return
  installed = true
  installFx()
  installSound()
  installHaptics()
  installInputModality()
  installAgentSignal()
}

export { installCyber }
