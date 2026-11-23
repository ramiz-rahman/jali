"use client"

import * as React from "react"
import "#src/vendor/cyberspec/components/ui/cyber/panel.css"

type Tone = "default" | "signal" | "flag"
type Variant = "spine" | "titled"

// The kit's container: a cut frame that holds one subject, with a line of
// micro-print over it. It's a <section> named by its heading, so a screen
// built from panels can be walked as landmarks.
//
// - `variant`: "spine" has a thick, hollow bar down its leading edge, which
//   fills while focus is anywhere inside, so the panel being worked in is
//   the lit one. "titled" puts the heading in a solid bar of its own, over
//   the frame.
// - `tone`: "default" is the accent, "signal" the cyan of readouts, "flag"
//   the yellow of the one thing to look at.
// - `code`: the micro-print over the frame. Decoration only.
// - `actions`: trailing content beside the heading: a readout, a badge, a
//   small key. In a titled panel it sits on the solid bar, in dark ink.
// - `footer`: a row along the foot, under a rule: key hints, a count, keys.
// - `level`: the heading's level, 3 by default. Use what fits the page.
function Panel({
  title,
  code,
  tone = "default",
  variant = "spine",
  level = 3,
  actions,
  footer,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: string
  code?: string
  tone?: Tone
  variant?: Variant
  level?: 2 | 3 | 4 | 5 | 6
  actions?: React.ReactNode
  footer?: React.ReactNode
}) {
  const id = React.useId()
  const Heading = `h${level}` as "h3"
  const head = (
    <>
      <Heading id={id} data-kit="panel-title">
        {title}
      </Heading>
      {actions != null && <div data-kit="panel-actions">{actions}</div>}
    </>
  )
  return (
    <section data-kit="panel" data-variant={variant} data-tone={tone} aria-labelledby={id} {...props}>
      {code && (
        <span data-kit="panel-code" data-micro aria-hidden>
          {code}
        </span>
      )}
      {variant === "titled" && (
        <header data-kit="panel-bar" data-frame="br">
          {head}
        </header>
      )}
      <div data-kit="panel-surface" data-frame={variant === "spine" ? "spine br" : "br"}>
        {variant === "spine" && <header data-kit="panel-head">{head}</header>}
        <div data-kit="panel-body">{children}</div>
        {footer != null && <footer data-kit="panel-footer">{footer}</footer>}
      </div>
    </section>
  )
}

export { Panel }
export type { Tone as PanelTone, Variant as PanelVariant }
