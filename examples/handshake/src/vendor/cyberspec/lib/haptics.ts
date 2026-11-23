type Haptic = "selection" | "light" | "medium" | "heavy" | "success" | "warning" | "error"

const patterns: Record<Haptic, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 20,
  heavy: 34,
  success: [12, 60, 20],
  warning: [22, 80, 22],
  error: [26, 50, 26, 50, 26],
}

const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
const hasSwitch = () => typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype

let label: HTMLLabelElement | null = null
function tapSwitch() {
  if (!label) {
    label = document.createElement("label")
    label.dataset.hapticSwitch = ""
    label.inert = true
    label.setAttribute("aria-hidden", "true")
    label.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.setAttribute("switch", "")
    input.tabIndex = -1
    label.append(input)
    document.body.append(label)
  }
  label.click()
}

let last = 0

// Two haptics within 30ms count as one, so a press that also steps a value
// is felt once.
function haptic(kind: Haptic) {
  if (typeof document === "undefined") return
  const now = performance.now()
  if (now - last < 30) return
  last = now
  // Outside a gesture (an agent's change, a timer) there's nothing to feel:
  // iOS stays silent and Chrome refuses the call and logs it.
  if (navigator.userActivation && !navigator.userActivation.isActive) return
  if (canVibrate()) navigator.vibrate(patterns[kind])
  else if (hasSwitch()) tapSwitch()
}

// Whether a value moving from `from` to `to` crosses into another step of
// `size`, for controls that slide through many values and tick at each.
const crosses = (from: number, to: number, size: number) => Math.floor(from / size) !== Math.floor(to / size)

const disabled = ':disabled, [aria-disabled="true"], [data-disabled]'
const presses: [string, Haptic][] = [
  ['[role="switch"], [role="checkbox"], [role="menuitemcheckbox"]', "medium"],
  ['[role="option"], [role="tab"], [role="radio"], [role="menuitem"], [role="menuitemradio"], [role="gridcell"], [role="treeitem"]', "selection"],
  ['[data-tone="primary"]', "medium"],
  ['button, [role="button"]', "light"],
]

function installHaptics() {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null
      if (!target?.closest || target.closest("[data-haptic-switch]") || !target.closest('[data-skin="cyber"]')) return
      for (const [selector, kind] of presses) {
        const el = target.closest(selector)
        if (!el) continue
        if (!el.matches(disabled)) haptic(kind)
        return
      }
    },
    true,
  )
}

export { crosses, haptic, installHaptics }
export type { Haptic }
