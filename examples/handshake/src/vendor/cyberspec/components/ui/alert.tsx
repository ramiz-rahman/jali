"use client"

import * as React from "react"
import { Check, Info, OctagonAlert, TriangleAlert } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/alert.css"

type Tone = "info" | "success" | "warning" | "danger"

// What each tone prints besides its color: a glyph on the spine and a word
// in the corner, so the four are told apart without seeing the hue. The two
// that can't wait interrupt a screen reader; the other two are polite.
const tones: Record<Tone, { glyph: React.ReactNode; word: string; role: "status" | "alert" }> = {
  info: { glyph: <Info aria-hidden />, word: "Notice", role: "status" },
  success: { glyph: <Check aria-hidden />, word: "Clear", role: "status" },
  warning: { glyph: <TriangleAlert aria-hidden />, word: "Caution", role: "alert" },
  danger: { glyph: <OctagonAlert aria-hidden />, word: "Critical", role: "alert" },
}

// An inline notice: a frame with a thick spine in the tone's color, its
// glyph printed on the spine, a title, a line of text and room for one key.
//
// - `tone`: "info" is the signal cyan, "success" green, "warning" yellow, and
//   "danger" is the accent with the frame lit, since red is the kit's resting
//   color and only a fill makes it urgent.
// - `action`: a key that answers the notice, usually a small Button.
// - `word` replaces the tone's printed word ("Notice", "Clear", "Caution",
//   "Critical").
function Alert({
  tone = "info",
  title,
  word,
  action,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  tone?: Tone
  title: string
  word?: string
  action?: React.ReactNode
}) {
  const spec = tones[tone]
  return (
    <div data-kit="alert" data-frame="spine br" data-tone={tone} role={spec.role} {...props}>
      <span data-kit="alert-glyph" aria-hidden>
        {spec.glyph}
      </span>
      <div data-kit="alert-body">
        <div data-kit="alert-head">
          <strong data-kit="alert-title">{title}</strong>
          <span data-kit="alert-word">{word ?? spec.word}</span>
        </div>
        {children != null && <p data-kit="alert-text">{children}</p>}
      </div>
      {action != null && <div data-kit="alert-action">{action}</div>}
    </div>
  )
}

export { Alert }
export type { Tone as AlertTone }
