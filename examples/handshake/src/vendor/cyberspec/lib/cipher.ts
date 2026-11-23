import { fxLevel } from "#src/vendor/cyberspec/lib/fx.ts"

const glyphs = "20772077207701010123456789!@#$%^&*()_+={}[]|;:,.<>?/←→"
const duration = 300
const ticks = 9
const idle = () => {}
const active = new WeakMap<HTMLElement, () => void>()

// Take the fast path for a single line. On a wrapped title, measure the
// browser's actual line breaks so each copy decodes in its original place.
function textLines(text: Text, range: Range) {
  range.selectNodeContents(text)
  if (range.getClientRects().length <= 1) return [{ value: text.data, rect: range.getBoundingClientRect() }]
  const lines: { value: string; rect: DOMRect }[] = []
  let start = 0
  for (const character of text.data) {
    range.setStart(text, start)
    start += character.length
    range.setEnd(text, start)
    const rect = range.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const previous = lines.at(-1)
    if (previous && Math.abs(previous.rect.top - rect.top) < 0.5) {
      const left = Math.min(previous.rect.left, rect.left)
      previous.rect.width = Math.max(previous.rect.right, rect.right) - left
      previous.rect.x = left
      previous.value += character
    } else {
      lines.push({ value: character, rect })
    }
  }
  return lines
}

function makeLayer(target: HTMLElement, attribute: string, value = "") {
  const layer = document.createElement("span")
  layer.setAttribute(attribute, value)
  layer.setAttribute("aria-hidden", "true")
  target.append(layer)
  return layer
}

function paintLabels(target: HTMLElement, layer: HTMLElement) {
  const bounds = layer.getBoundingClientRect()
  const runs = []
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let offset = 0
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement
    if (!node.data.trim() || !parent || parent.closest("svg, [hidden], [aria-hidden=true], [data-cipher-ignore], [data-sr-only], .sr-only")) continue
    const style = getComputedStyle(parent)
    if (style.visibility !== "visible") continue
    for (const { value, rect } of textLines(node, range)) {
      if (!rect.width || !rect.height || !bounds.width || !bounds.height) continue
      const copy = document.createElement("span")
      copy.dataset.cipherNoise = ""
      copy.style.left = `${100 * (rect.left - bounds.left + rect.width / 2) / bounds.width}%`
      copy.style.top = `${100 * (rect.top - bounds.top + rect.height / 2) / bounds.height}%`
      if (parent !== target) {
        // Computed font shorthands can be empty when a label uses font variants.
        for (const key of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariant",
          "fontFeatureSettings", "fontVariationSettings", "lineHeight", "letterSpacing", "wordSpacing",
          "textTransform", "direction", "color"] as const) copy.style[key] = style[key]
      }
      const chars = Array.from(value)
      runs.push({ node, original: node.data, chars, copy, offset })
      offset += chars.length
    }
  }
  layer.append(...runs.map(run => run.copy))
  return runs
}

function play(target: HTMLElement, mode: "button" | "text" | "edge"): () => void {
  active.get(target)?.()
  const skin = target.closest('[data-skin="cyber"]')
  const motion = matchMedia("(prefers-reduced-motion: no-preference) and (forced-colors: none)")
  const hover = mode === "button"
  const allowed = () => target.isConnected && motion.matches && (skin?.getAttribute("data-fx") ?? fxLevel()) === "full"
    && !target.closest(":disabled, [data-disabled], [aria-disabled=true], [data-pending]")
    && (!hover || target.hasAttribute("data-cipher"))
  if (!allowed() || (hover && !matchMedia("(any-hover: hover)").matches)) return idle

  let ink: HTMLElement | undefined
  let bands: HTMLElement | undefined
  if (hover || mode === "text") {
    if (getComputedStyle(target).position === "static") target.setAttribute("data-cipher-anchor", "")
    ink = makeLayer(target, "data-cipher-text")
    target.setAttribute("data-decoding", "")
  }
  const runs = ink ? paintLabels(target, ink) : []
  if (mode !== "text") {
    bands = makeLayer(target, "data-cipher-frame", mode === "edge" ? "edge" : "full")
    const edge = document.createElement("i")
    edge.dataset.frame = target.dataset.frame ?? ""
    for (let i = 0; i < 4; i++) bands.append(edge.cloneNode())
    if (mode !== "edge") {
      edge.dataset.cipherEdge = ""
      bands.append(edge)
    }
  }

  let frame = 0
  let lastTick = -1
  const start = performance.now()
  function stop() {
    if (active.get(target) !== stop) return
    active.delete(target)
    cancelAnimationFrame(frame)
    target.removeAttribute("data-decoding")
    target.removeAttribute("data-cipher-anchor")
    target.removeAttribute("data-cipher-tear")
    ink?.remove()
    bands?.remove()
    if (hover) {
      target.removeEventListener("pointerleave", stop)
      target.removeEventListener("pointercancel", stop)
      target.removeEventListener("pointerdown", stop)
    }
  }
  function paint(now: number) {
    const elapsed = now - start
    if (elapsed >= duration || !allowed() || (ink && !ink.isConnected) || (bands && !bands.isConnected)) return stop()
    const tick = Math.floor(Math.max(0, elapsed) * ticks / duration)
    if (tick !== lastTick) {
      for (const { node, original, chars, copy, offset } of runs) {
        if (!node.isConnected || node.data !== original) return stop()
        copy.textContent = chars.map((char, index) => {
          if (/\s/.test(char) || tick >= 4 + (offset + index + 2) % 5) return char
          return glyphs[Math.floor(Math.random() * glyphs.length)]
        }).join("")
      }
      if (bands && tick >= 2 && tick <= 6) target.dataset.cipherTear = String(tick)
      else target.removeAttribute("data-cipher-tear")
      lastTick = tick
    }
    frame = requestAnimationFrame(paint)
  }
  active.set(target, stop)
  if (hover) {
    target.addEventListener("pointerleave", stop)
    target.addEventListener("pointercancel", stop)
    target.addEventListener("pointerdown", stop)
  }
  paint(start)
  return stop
}

export function playCipherText(target: HTMLElement) {
  return play(target, "text")
}

export function playCipherEdge(target: HTMLElement) {
  return play(target, "edge")
}

export function playButtonCipher(target: HTMLElement) {
  return play(target, "button")
}
