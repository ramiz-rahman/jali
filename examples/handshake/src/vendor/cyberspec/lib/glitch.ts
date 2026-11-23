import { fxFull } from "#src/vendor/cyberspec/lib/fx.ts"

// Text effects that run from script. Both do nothing below FX "full": the
// text is simply there.

const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/<>[]{}=+*"

// Decode `text` into `node`, left to right: characters ahead of the wave are
// noise, and each settles as the wave passes. The node should be
// aria-hidden with the real text beside it for assistive technology (see
// GlitchText), since its content is nonsense partway through.
//
// Returns a function that stops it and leaves the full text.
function scramble(node: HTMLElement, text: string, { duration = 480, delay = 0 }: { duration?: number; delay?: number } = {}) {
  if (!fxFull() || !text) {
    node.textContent = text
    return () => {}
  }
  let frame = 0
  let start = 0
  let done = false
  const finish = () => {
    done = true
    cancelAnimationFrame(frame)
    node.textContent = text
  }
  const step = (now: number) => {
    if (done) return
    if (!start) start = now + delay
    const t = Math.max(0, Math.min(1, (now - start) / duration))
    const settled = Math.floor(t * text.length)
    let out = text.slice(0, settled)
    // A short fringe of noise ahead of the wave, and blanks beyond it, so
    // the line grows rather than boiling end to end.
    for (let i = settled; i < text.length; i++) {
      const ch = text[i]
      if (ch === " " || ch === "\n") out += ch
      else if (i < settled + 4) out += glyphs[(Math.random() * glyphs.length) | 0]
      else out += " "
    }
    node.textContent = out
    if (t >= 1) return finish()
    frame = requestAnimationFrame(step)
  }
  node.textContent = text.replace(/[^\s]/g, " ")
  frame = requestAnimationFrame(step)
  return finish
}

// A burst of interference on an element: it carries `data-glitching` for
// `length` milliseconds, which the skin (or the component's stylesheet)
// answers with an animation.
function burst(node: HTMLElement, length = 320) {
  if (!fxFull()) return
  node.dataset.glitching = ""
  setTimeout(() => delete node.dataset.glitching, length)
}

export { burst, scramble }
