import { elementOf, observe, type ObservedChange } from "@ui-sdk/core/observe"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"

// When an agent changes something through the ui-sdk agent bridge, the page
// shows it: the control it touched lights in the signal color for a moment
// (`data-agent-touch`, styled in fx.css), a tick plays, and the change is
// announced to assistive technology. A person sharing the page with an
// agent can then always tell what the agent did, and what they did
// themselves.
//
// Listeners added with `onAgentChange` get every agent change too, for an
// activity log.
const listeners = new Set<(change: ObservedChange) => void>()
const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

let region: HTMLElement | null = null
function announce(text: string) {
  if (!region) {
    region = document.createElement("div")
    region.setAttribute("role", "status")
    region.setAttribute("aria-live", "polite")
    region.dataset.agentAnnouncer = ""
    region.style.cssText = "position:fixed;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap"
    document.body.append(region)
  }
  region.textContent = text
}

const say = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value))

function touch(change: ObservedChange) {
  let el: HTMLElement | null = null
  try {
    el = elementOf(change.ref)
  } catch {}
  if (el && el.closest('[data-skin="cyber"]')) {
    el.dataset.agentTouch = ""
    clearTimeout(timers.get(el))
    timers.set(
      el,
      setTimeout(() => delete el.dataset.agentTouch, 900),
    )
    if (!el.closest("[data-agent-quiet]")) el.scrollIntoView({ block: "nearest", inline: "nearest" })
  }
  sfx("agent")
  announce(`Agent set ${change.label ?? change.component} ${change.key} to ${say(change.value)}`)
}

function onAgentChange(listener: (change: ObservedChange) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function installAgentSignal() {
  observe((change) => {
    if (change.source !== "agent") return
    touch(change)
    listeners.forEach((listener) => listener(change))
  })
}

export { installAgentSignal, onAgentChange }
