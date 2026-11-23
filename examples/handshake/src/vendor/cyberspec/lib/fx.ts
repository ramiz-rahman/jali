type FxLevel = "full" | "calm" | "off"

const storageKey = "cyberspec:fx"
const levels: FxLevel[] = ["full", "calm", "off"]
const listeners = new Set<(level: FxLevel) => void>()

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches

function stored(): FxLevel | null {
  try {
    const value = localStorage.getItem(storageKey) as FxLevel | null
    return value && levels.includes(value) ? value : null
  } catch {
    return null
  }
}

function fxLevel(): FxLevel {
  if (typeof document === "undefined") return "full"
  return stored() ?? (reduced() ? "off" : "full")
}

function apply() {
  const level = fxLevel()
  for (const root of document.querySelectorAll<HTMLElement>('[data-skin="cyber"]:not([data-fx-pinned])')) root.dataset.fx = level
  listeners.forEach((listener) => listener(level))
}

// Choose a level, or pass null to go back to following the system.
function setFxLevel(level: FxLevel | null) {
  try {
    if (level) localStorage.setItem(storageKey, level)
    else localStorage.removeItem(storageKey)
  } catch {}
  apply()
}

function onFxChange(listener: (level: FxLevel) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Whether decorative effects (glitches, scrambles, flicker) should run.
const fxFull = () => fxLevel() === "full"
// Whether anything should move at all.
const fxMoves = () => fxLevel() !== "off"

function installFx() {
  apply()
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", apply)
  // Roots that mount later (a second <Cyber>, a route change) get the level
  // too.
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof HTMLElement && (node.matches('[data-skin="cyber"]') || node.querySelector('[data-skin="cyber"]'))) return apply()
  }).observe(document.body, { childList: true, subtree: true })
}

export { fxFull, fxLevel, fxMoves, installFx, levels as fxLevels, onFxChange, setFxLevel }
export type { FxLevel }
