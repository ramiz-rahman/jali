import { soundSamples } from "#src/vendor/cyberspec/lib/sound-samples.ts"

// Recorded ticks, button presses, toggles and modal cues share the Web Audio
// bus with the remaining synthesized voices. PCM lives in a registry module so installed
// components work without a hosted asset URL or an asynchronous first play.
//
// Sound is off until someone turns it on, and the choice is remembered.
// `sfx(voice)` plays one; components call it from their handlers, and
// `installSound()` also plays the common ones from page-wide listeners, so a
// plain button, option or tab sounds without any code of its own.
type Voice =
  | "hover" // the pointer arriving on something pressable
  | "increment" // a successful plus/up action
  | "decrement" // a successful minus/down action
  | "modal-open" // a dialog, alert dialog or drawer appearing
  | "modal-close" // the same recording reversed as it closes
  | "press" // a button press or a change of tab or segment
  | "confirm" // a primary action
  | "select" // an option or a row chosen
  | "tick" // the shared recorded tick: pagination and carousel navigation
  | "on" // a switch or a checkbox turning on
  | "off" // ...and off
  | "open" // a small popup or an informational toast appearing
  | "close" // ...and leaving
  | "type" // a key in a text field
  | "glitch" // a burst of interference
  | "success"
  | "warning"
  | "error"
  | "deny" // refused: a disabled control, an agent's blocked step
  | "agent" // an agent acting on the page

const storageKey = "cyberspec:sound"
let enabled = false
try {
  enabled = typeof localStorage !== "undefined" && localStorage.getItem(storageKey) === "on"
} catch {}
const listeners = new Set<(on: boolean) => void>()

const soundEnabled = () => enabled

function setSoundEnabled(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(storageKey, on ? "on" : "off")
  } catch {}
  if (on) unlock()
  else {
    stopAdjustments()
    for (const stop of modalPlayback.values()) stop()
  }
  if (ctx && master) master.gain.setValueAtTime(on ? 0.5 : 0, ctx.currentTime)
  listeners.forEach((listener) => listener(on))
}

function onSoundChange(listener: (on: boolean) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
const reversedSamples = {
  modalClose: "modalCloseBase",
  drawerClose: "drawerCloseBase",
  drawerCloseShort: "drawerCloseShortBase",
} as const
type Sample = keyof typeof soundSamples | keyof typeof reversedSamples
const buffers = new Map<Sample, AudioBuffer>()
const adjustments = new Set<() => void>()
const modalPlayback = new Map<Element, () => void>()

function stopAdjustments() {
  for (const stop of adjustments) stop()
}

function sampleBuffer(name: Sample) {
  if (!ctx) return null
  let buffer = buffers.get(name)
  if (!buffer) {
    // Closing uses the same cue, time-compressed to the exit duration and
    // reversed. Cache it once; playback never shifts the recording's pitch.
    if (Object.hasOwn(reversedSamples, name)) {
      const forward = sampleBuffer(reversedSamples[name as keyof typeof reversedSamples])
      if (!forward) return null
      buffer = ctx.createBuffer(1, forward.length, forward.sampleRate)
      const original = forward.getChannelData(0)
      const reversed = buffer.getChannelData(0)
      for (let i = 0; i < original.length; i++) reversed[i] = original[original.length - 1 - i]!
      buffers.set(name, buffer)
      return buffer
    }
    const { pcm, sampleRate } = soundSamples[name as keyof typeof soundSamples]
    const bytes = atob(pcm)
    buffer = ctx.createBuffer(1, bytes.length / 2, sampleRate)
    const channel = buffer.getChannelData(0)
    for (let i = 0; i < channel.length; i++) {
      const value = bytes.charCodeAt(i * 2) | (bytes.charCodeAt(i * 2 + 1) << 8)
      channel[i] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000
    }
    buffers.set(name, buffer)
  }
  return buffer
}

function sample(name: Sample, at: number, level: number, owner?: Element) {
  if (!ctx || !master) return
  if (owner) modalPlayback.get(owner)?.()
  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  source.buffer = sampleBuffer(name)
  gain.gain.value = level
  source.connect(gain).connect(master)
  const stop = () => {
    if (!ctx) return
    if (owner && modalPlayback.get(owner) === stop) modalPlayback.delete(owner)
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.004)
    source.stop(ctx.currentTime + 0.005)
  }
  source.onended = () => {
    if (owner && modalPlayback.get(owner) === stop) modalPlayback.delete(owner)
    source.disconnect()
    gain.disconnect()
  }
  if (owner) modalPlayback.set(owner, stop)
  source.start(at)
}

function modalSample(owner: Element | undefined, opening: boolean): Sample {
  // Keep sound brief when the visual is instant or reduced to a small fade.
  const quietMotion = owner && (owner.closest('[data-skin="cyber"]')?.getAttribute("data-fx") === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches)
  if (quietMotion) return opening ? "modalCloseBase" : "modalClose"
  if (owner?.getAttribute("data-slot") === "drawer-content") {
    if (opening) return "drawerOpen"
    const side = owner.getAttribute("data-side")
    return side === "bottom" || side === "top" ? "drawerCloseShort" : "drawerClose"
  }
  return opening ? "modalOpen" : "modalClose"
}

// One owner per adjustment control. Only actual accepted movement renews
// the loop; holding still never leaves it ticking. Stop is also safe to use
// for unmount, commit, disabled state and cancellation cleanup.
function createAdjustmentSound() {
  let source: AudioBufferSourceNode | null = null
  let gain: GainNode | null = null
  let idle: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    clearTimeout(idle)
    idle = undefined
    adjustments.delete(stop)
    if (source && gain && ctx) {
      const ending = source
      const endingGain = gain
      endingGain.gain.cancelScheduledValues(ctx.currentTime)
      endingGain.gain.setValueAtTime(endingGain.gain.value, ctx.currentTime)
      endingGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.004)
      ending.stop(ctx.currentTime + 0.005)
      ending.onended = () => {
        ending.disconnect()
        endingGain.disconnect()
      }
    }
    source = null
    gain = null
  }
  const move = () => {
    if (!enabled) return stop()
    unlock()
    if (!ctx || !master || ctx.state !== "running") return
    if (!source) {
      source = ctx.createBufferSource()
      gain = ctx.createGain()
      source.buffer = sampleBuffer("adjust")
      source.loop = true
      gain.gain.value = 0.195
      source.connect(gain).connect(master)
      source.start(ctx.currentTime + 0.001)
      adjustments.add(stop)
    }
    clearTimeout(idle)
    idle = setTimeout(stop, 100)
  }
  return { move, stop }
}

// Browsers only start audio inside a gesture, so the context is made (and
// resumed) on the first press or key.
function unlock() {
  if (!enabled || typeof AudioContext === "undefined") return
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    // A gentle ceiling, so overlapping blips never clip.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.ratio.value = 8
    master.connect(limiter).connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state !== "running") ctx.resume().catch(() => {})
}

// One oscillator with a pitch glide and a fast decay.
function tone(
  at: number,
  { type = "sine", from, to = from, length, level }: { type?: OscillatorType; from: number; to?: number; length: number; level: number },
) {
  if (!ctx || !master) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(level, at + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(master)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

// A slice of band-passed noise: static.
function hiss(at: number, { freq, q = 2, length, level }: { freq: number; q?: number; length: number; level: number }) {
  if (!ctx || !master || !noise) return
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  src.buffer = noise
  src.playbackRate.value = 0.8 + Math.random() * 0.5
  filter.type = "bandpass"
  filter.frequency.value = freq
  filter.Q.value = q
  gain.gain.setValueAtTime(level, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  src.connect(filter).connect(gain).connect(master)
  src.start(at, Math.random() * 0.1, length + 0.02)
}

// One small recorded tick for lightweight interactions. Keep semantic voice
// names so a future recording can replace one interaction independently.
const tick = (at: number) => sample("hover", at, 0.42)

const voices: Record<Voice, (at: number, owner?: Element) => void> = {
  hover: tick,
  increment: (at) => sample("increment", at, 0.42),
  decrement: (at) => sample("decrement", at, 0.42),
  "modal-open": (at, owner) => sample(modalSample(owner, true), at, 0.1, owner),
  "modal-close": (at, owner) => sample(modalSample(owner, false), at, 0.1, owner),
  press: (at) => sample("press", at, 0.14),
  confirm: (at) => sample("press", at, 0.14),
  select: tick,
  tick,
  on: (at) => sample("on", at, 0.12),
  off: (at) => sample("off", at, 0.12),
  open: tick,
  close: tick,
  type: tick,
  glitch: tick,
  success: (at) => {
    tone(at, { from: 988, length: 0.08, level: 0.07 })
    tone(at + 0.075, { from: 1480, length: 0.16, level: 0.07 })
  },
  warning: (at) => {
    tone(at, { type: "triangle", from: 740, length: 0.09, level: 0.08 })
    tone(at + 0.12, { type: "triangle", from: 740, length: 0.09, level: 0.08 })
  },
  error: (at) => {
    tone(at, { type: "square", from: 220, to: 160, length: 0.14, level: 0.07 })
    tone(at + 0.11, { type: "square", from: 174, to: 120, length: 0.2, level: 0.07 })
    hiss(at, { freq: 900, q: 1, length: 0.1, level: 0.04 })
  },
  deny: (at) => tone(at, { type: "square", from: 196, to: 150, length: 0.09, level: 0.06 }),
  agent: tick,
}

const tickVoices = new Set<Voice>(["hover", "select", "tick", "open", "close", "type", "glitch", "agent"])
let lastAt = 0
let lastFamily: Voice | null = null
let playbackSequence = 0

function sfx(voice: Voice, owner?: Element) {
  if (!enabled) return
  unlock()
  if (!ctx || ctx.state !== "running") return
  // Voices sharing a recording also share duplicate suppression: selecting
  // a menu option and closing its popup is one tick, not two stacked ticks.
  const now = performance.now()
  const family = tickVoices.has(voice) ? "tick" : voice === "confirm" ? "press" : voice
  if (family === lastFamily && now - lastAt < 25) return
  lastAt = now
  lastFamily = family
  playbackSequence++
  voices[voice](ctx.currentTime + 0.001, owner)
}

const disabled = ':disabled, [aria-disabled="true"], [data-disabled]'
const typing =
  'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"]'
const pressable = 'button, [role="button"], a[href], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="treeitem"], [role="gridcell"]'
const hoverable = `${pressable}, [role="slider"], [role="separator"][aria-valuenow], input:not([type="hidden"]), textarea, select, summary`
const keyboardCollection = '[role="menu"], [role="menubar"], [role="listbox"], [role="combobox"], [role="tablist"], [role="radiogroup"], [role="tree"], [role="grid"], [role="toolbar"], [data-slot="toggle-group"]'
const tabChoice = '[role="tab"], [data-slot="segmented-control-item"]'
const activeTabChoice = '[role="tab"][aria-selected="true"], [data-slot="segmented-control-item"][aria-checked="true"]'
const navigationKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])

// Most collections move real focus. Comboboxes keep focus in the input and
// expose the active option through ARIA instead. Include values for calendar
// cells whose DOM node can be reused, and labels for closed Select typeahead.
function keyboardSelection(tree: Element | null, carousel: Element | null) {
  const focused = document.activeElement
  if (!focused?.closest('[data-skin="cyber"]') || (!focused.closest(keyboardCollection) && !carousel?.contains(focused))) return null
  const descendant = focused.getAttribute("aria-activedescendant")
  const item = (descendant && document.getElementById(descendant)) || focused
  const select = focused.closest('[data-slot="select-trigger"]')
  return {
    item,
    activeChoice: item.matches(tabChoice) ? item.closest(keyboardCollection)?.querySelector(activeTabChoice) : null,
    state: JSON.stringify([
      item.id,
      item.getAttribute("data-value"),
      item.getAttribute("aria-expanded"),
      item.getAttribute("aria-selected"),
      item.getAttribute("aria-checked"),
      item.getAttribute("aria-pressed"),
      select?.querySelector('[data-slot="select-value"]')?.textContent ?? select?.textContent,
      // Tree shortcuts can expand siblings/descendants without moving focus.
      tree && Array.from(tree.querySelectorAll('[role="treeitem"][aria-expanded]'), (el) => [el.id, el.getAttribute("aria-expanded")]),
      carousel && Array.from(carousel.querySelectorAll('[data-slot="carousel-item"][data-active]'), (el) => el.id),
    ]),
  }
}

// What a click on something sounds like, from what it is. A component can
// say otherwise with `data-sfx="<voice>"`, or "none" to stay quiet and play
// its own.
function voiceFor(el: Element): Voice | null {
  const own = el.closest<HTMLElement>("[data-sfx]")?.dataset.sfx
  if (own) return Object.hasOwn(voices, own) ? (own as Voice) : null
  const role = el.getAttribute("role")
  if (role === "switch" || role === "checkbox" || role === "menuitemcheckbox") {
    const on = el.getAttribute("aria-checked") === "true" || el.hasAttribute("data-checked")
    // Read before the click lands: on now means it's about to turn off.
    return on ? "off" : "on"
  }
  if (role === "option" || role === "radio" || role === "menuitem" || role === "menuitemradio" || role === "gridcell" || role === "treeitem") return "select"
  if (el.matches('[data-tone="primary"]')) return "confirm"
  // The transition owns this feedback. A long generic button recording
  // underneath it would keep sounding after the modal has finished moving.
  if (/^(dialog|alert-dialog|drawer)-(trigger|close)$/.test(el.getAttribute("data-slot") ?? "")) return null
  return "press"
}

function installSound() {
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, unlock, { capture: true, passive: true })
  for (const type of ["pointerup", "pointercancel", "keyup"]) document.addEventListener(type, stopAdjustments, true)
  window.addEventListener("blur", stopAdjustments)
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") stopAdjustments()
  }, true)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") stopAdjustments()
    else if (enabled && ctx && ctx.state !== "running") ctx.resume().catch(() => {})
  })

  document.addEventListener(
    "click",
    (event) => {
      if (!enabled) return
      const el = (event.target as Element | null)?.closest?.(`${pressable}, [data-sfx]`)
      if (!el || !el.closest('[data-skin="cyber"]')) return
      if (el.matches(disabled)) return sfx("deny")
      if (el.matches(tabChoice) && !el.closest("[data-sfx]")) {
        // A click can reselect the active view or be rejected by the consumer.
        // Give the component time to commit before sounding its new choice.
        if (el.matches(activeTabChoice)) return
        requestAnimationFrame(() => {
          if (el.isConnected && el.matches(activeTabChoice)) sfx("press")
        })
        return
      }
      const voice = voiceFor(el)
      if (voice) sfx(voice)
    },
    true,
  )

  // Hover only ticks for a mouse, and only on things that react to it.
  let hovered: Element | null = null
  document.addEventListener(
    "pointerover",
    (event) => {
      if (!enabled || event.pointerType !== "mouse") return
      const el = (event.target as Element | null)?.closest?.(hoverable) ?? null
      if (el === hovered) return
      hovered = el
      // data-sfx="none" suppresses automatic clicks, never hover coverage.
      // An explicit hover opt-out is separate for controls that need it.
      if (el && el.closest('[data-skin="cyber"]') && !el.closest(disabled) && el.closest<HTMLElement>("[data-sfx-hover]")?.dataset.sfxHover !== "none") sfx("hover")
    },
    { capture: true, passive: true },
  )
  document.addEventListener("pointerout", (event) => {
    if (hovered && (!(event.relatedTarget instanceof Node) || !hovered.contains(event.relatedTarget))) hovered = null
  }, { capture: true, passive: true })

  let navigationFrame = 0
  let pendingNavigation: { before: NonNullable<ReturnType<typeof keyboardSelection>>; tree: Element | null; carousel: Element | null; sequence: number } | null = null
  const finishNavigation = () => {
    cancelAnimationFrame(navigationFrame)
    const pending = pendingNavigation
    pendingNavigation = null
    if (!pending || pending.sequence !== playbackSequence) return
    const after = keyboardSelection(pending.tree, pending.carousel)
    if (after?.activeChoice && after.activeChoice !== pending.before.activeChoice) sfx("press")
    else if (after && (after.item !== pending.before.item || after.state !== pending.before.state)) sfx("tick")
  }

  document.addEventListener(
    "keydown",
    (event) => {
      // Finish the preceding move before capturing a repeated key, even if
      // several key events arrive within one animation frame.
      finishNavigation()
      const target = event.target as Element | null
      const treeShortcut = event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight") && target?.closest('[role="tree"]')
      if (!enabled || event.isComposing || event.metaKey || event.ctrlKey || (event.altKey && !treeShortcut)) return
      // Native tab and segment buttons deliver Enter/Space through click.
      if ((event.key === "Enter" || event.key === " ") && target instanceof HTMLButtonElement && target.matches(tabChoice)) return
      // Menu choices handle Enter/Space directly without a click. Wait
      // for the resulting state so canceled changes stay silent as well.
      const check = target?.closest?.('[role="menuitemcheckbox"], [role="menuitemradio"]')
      if (check && check.closest('[data-skin="cyber"]') && !check.matches(disabled) && (event.key === " " || event.key === "Enter")) {
        const before = check.getAttribute("aria-checked")
        const voice = voiceFor(check)
        requestAnimationFrame(() => {
          if (voice && check.getAttribute("aria-checked") !== before) sfx(voice)
        })
        return
      }
      const typeahead = event.key.length === 1 && !target?.closest(typing)
      if (navigationKeys.has(event.key) || typeahead || event.key === "Enter") {
        const tree = event.key === "*" || treeShortcut ? target?.closest('[role="tree"]') ?? null : null
        let carousel = target?.closest('[data-slot="carousel-viewport"]') ?? null
        if (carousel) {
          const arrows = carousel.getAttribute("data-orientation") === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"]
          if (event.shiftKey || ![...arrows, "Home", "End"].includes(event.key) || target?.closest(`${keyboardCollection}, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"]`)) carousel = null
        }
        const before = keyboardSelection(tree, carousel)
        if (before) {
          pendingNavigation = { before, tree, carousel, sequence: playbackSequence }
          // The SDK can preventDefault on a successful move. Compare the
          // result after its handlers/render instead of inspecting that flag.
          // Existing popup/selection/control feedback wins over this fallback.
          navigationFrame = requestAnimationFrame(finishNavigation)
        }
      }
      if (!target?.closest?.(typing) || !target.closest('[data-skin="cyber"]')) return
      if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter" || event.key === "Unidentified") sfx("type")
    },
    true,
  )

  // A popup's content owns its sound. Backdrops, viewports and triggers can
  // share data-open, but none represents another opening. New content may
  // arrive already open, so attribute observation alone misses its entrance.
  const content = '[data-slot$="-content"]'
  const modalSlots = new Set(["dialog-content", "alert-dialog-content", "drawer-content"])
  const popupState = new WeakMap<Element, boolean>()
  for (const el of document.querySelectorAll(content)) {
    if (el.closest('[data-skin="cyber"]')) popupState.set(el, el.hasAttribute("data-open"))
  }
  new MutationObserver((records) => {
    const changed = new Set<Element>()
    const collect = (node: Node) => {
      if (!(node instanceof Element)) return
      if (node.matches(content)) changed.add(node)
      node.querySelectorAll(content).forEach((el) => changed.add(el))
    }
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target instanceof Element && record.target.matches(content)) changed.add(record.target)
      } else {
        record.addedNodes.forEach(collect)
        record.removedNodes.forEach(collect)
      }
    }
    for (const el of changed) {
      const inSkin = el.isConnected && Boolean(el.closest('[data-skin="cyber"]'))
      if (!inSkin && !popupState.has(el)) continue
      const before = popupState.get(el) ?? false
      const open = inSkin && el.hasAttribute("data-open")
      if (el.hasAttribute("data-dragging")) modalPlayback.get(el)?.()
      // Track while muted too, and read the final state of a mutation batch.
      // An exit transition followed by removal is still just one close.
      popupState.set(el, open)
      if (open === before) continue
      const modal = modalSlots.has(el.getAttribute("data-slot") ?? "")
      sfx(modal ? (open ? "modal-open" : "modal-close") : (open ? "open" : "close"), modal ? el : undefined)
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-open", "data-dragging"] })
}

export { createAdjustmentSound, installSound, onSoundChange, setSoundEnabled, sfx, soundEnabled }
export type { Voice }
