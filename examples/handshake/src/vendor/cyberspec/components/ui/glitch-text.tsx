import * as React from "react"
import { burst, scramble } from "#src/vendor/cyberspec/lib/glitch.ts"
import "#src/vendor/cyberspec/components/ui/cyber/glitch-text.css"

// Text that decodes itself into place, and tears for a moment when asked.
//
// The words a screen reader gets never change: the real text sits in a
// visually hidden span, and the animated copy beside it is aria-hidden.
// Below FX "full" nothing animates; the text is simply there.
//
// - `decode`: "mount" decodes once when it appears, "view" when it scrolls
//   into view, "hover" each time the pointer arrives. Changing `children`
//   always decodes to the new text.
// - `as`: the element to render, "span" by default.
function GlitchText({
  children,
  as: Tag = "span",
  decode = "mount",
  duration,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  children: string
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div" | "strong"
  decode?: "mount" | "view" | "hover" | "none"
  duration?: number
}) {
  const visible = React.useRef<HTMLSpanElement>(null)
  const stop = React.useRef<() => void>(() => {})
  const run = React.useCallback(() => {
    const node = visible.current
    if (!node) return
    stop.current()
    stop.current = scramble(node, children, { duration: duration ?? Math.min(900, 220 + children.length * 22) })
    burst(node.parentElement!, 300)
  }, [children, duration])

  React.useEffect(() => {
    const node = visible.current
    if (!node) return
    if (decode === "none" || decode === "hover") {
      node.textContent = children
      return
    }
    if (decode === "mount") {
      run()
      return () => stop.current()
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        run()
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      stop.current()
    }
  }, [children, decode, run])

  const Root = Tag as "span"
  return (
    <Root data-kit="glitch-text" onPointerEnter={decode === "hover" ? run : undefined} {...props}>
      <span data-sr-only>{children}</span>
      <span ref={visible} data-kit="glitch-text-visible" aria-hidden>
        {children}
      </span>
    </Root>
  )
}

export { GlitchText }
