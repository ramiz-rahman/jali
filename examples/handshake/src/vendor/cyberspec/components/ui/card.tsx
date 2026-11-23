import * as React from "react"
import { ArrowUpRight, Check, ChevronRight } from "lucide-react"
import { playCipherText } from "#src/vendor/cyberspec/lib/cipher.ts"
import "#src/vendor/cyberspec/components/ui/cyber/card.css"

// A small content card: a still in a cut frame, a title, a line of meta, a
// few words and a foot.
//
// Give it `href` or `onClick` and the whole card is one target: it gains the
// raised tab of a key, lights on hover with the kit's state language, and a
// band scans down its still as the pointer arrives. The link or button is a
// layer over the card named by the title, so a screen reader hears the
// title alone, and keys in the footer stay separately pressable.
//
// - `media`: what goes in the frame at the top: an <svg>, an <img>.
// - `meta`: the line under the title, in mono: a place, a maker, a count.
// - `pressed`: with `onClick`, makes the card a toggle and holds it lit,
//   with a check where its arrow was.
// - `disabled`: with `onClick`, hatches the card and stops the press.
// - `cipher`: on an interactive card, decode the title as the pointer enters.
// - `level`: the title's heading level, 3 by default.
function Card({
  title,
  meta,
  media,
  footer,
  href,
  onClick,
  pressed,
  disabled,
  cipher = false,
  level = 3,
  children,
  ...props
}: Omit<React.ComponentProps<"article">, "title" | "onClick"> & {
  title: string
  meta?: React.ReactNode
  media?: React.ReactNode
  footer?: React.ReactNode
  href?: string
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  pressed?: boolean
  disabled?: boolean
  cipher?: boolean
  level?: 2 | 3 | 4 | 5 | 6
}) {
  const id = React.useId()
  const Heading = `h${level}` as "h3"
  const interactive = href != null || onClick != null
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const cipherEnabled = cipher && interactive && !disabled
  React.useEffect(() => {
    const heading = headingRef.current
    const card = heading?.closest("article")
    if (!cipherEnabled || !heading || !card) return

    let cancel: (() => void) | undefined
    const stop = () => {
      cancel?.()
      cancel = undefined
    }
    const listeners = new AbortController()
    const options = { signal: listeners.signal }
    card.addEventListener("pointerenter", event => {
      if (event.pointerType === "touch" || !matchMedia("(hover: hover)").matches) return
      stop()
      cancel = playCipherText(heading)
    }, options)
    card.addEventListener("pointerleave", stop, options)
    card.addEventListener("pointercancel", stop, options)
    card.addEventListener("pointerdown", stop, options)
    return () => {
      listeners.abort()
      stop()
    }
  }, [cipherEnabled, level, title])

  return (
    <article
      data-kit="card"
      data-frame={interactive ? "notch br" : "br"}
      data-frame-focus={interactive ? "within" : undefined}
      data-press-flash={interactive ? "" : undefined}
      data-interactive={interactive ? "" : undefined}
      data-pressed={pressed ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      {...props}
    >
      {href != null ? (
        <a data-kit="card-action" href={href} onClick={onClick} aria-labelledby={id} />
      ) : onClick != null ? (
        <button type="button" data-kit="card-action" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-labelledby={id} />
      ) : null}
      {media != null && (
        <div data-kit="card-media" data-frame="br" data-scanlines="">
          {media}
        </div>
      )}
      <div data-kit="card-body">
        <div data-kit="card-head">
          <Heading ref={headingRef} id={id} data-kit="card-title">
            {title}
          </Heading>
          {interactive && (
            <span data-kit="card-mark" aria-hidden>
              {pressed ? <Check /> : href != null ? <ArrowUpRight /> : <ChevronRight />}
            </span>
          )}
        </div>
        {meta != null && <p data-kit="card-meta">{meta}</p>}
        {children != null && <div data-kit="card-text">{children}</div>}
      </div>
      {footer != null && <footer data-kit="card-footer">{footer}</footer>}
    </article>
  )
}

export { Card }
