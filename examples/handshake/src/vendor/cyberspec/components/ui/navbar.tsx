import * as React from "react"
import "#src/vendor/cyberspec/components/ui/cyber/navbar.css"

type NavbarItem = {
  href: string
  label: string
  /** The page being shown. Marked with aria-current, the signal color and a bar on the rule. */
  current?: boolean
  icon?: React.ReactNode
}

type ReadoutTone = "signal" | "flag" | "ok"

// The bar across the top of a screen: status readouts at the leading end,
// the screen's pages in the middle, and what you're carrying at the far end,
// all sitting on one rule.
//
// - `label` names the navigation ("Deck sections"), so it can be told from
//   any other on the page.
// - `items` are the pages. Mark the one being shown `current`.
// - `leading` and `trailing` take anything; NavbarReadout is made for them.
// - `onNavigate` runs when a page is chosen, before the browser follows the
//   link: call `event.preventDefault()` there to hand it to a router.
// - `code` is the line of micro-print under the rule.
//
// With room it's one row. In a narrower container the readouts move to a row
// of their own above the pages, and narrower still the pages wrap two to a
// line. Nothing scrolls sideways and nothing is hidden.
function Navbar({
  label,
  items,
  leading,
  trailing,
  onNavigate,
  code = "NODE 3F:A2 // LINK STABLE",
  ...props
}: Omit<React.ComponentProps<"nav">, "children"> & {
  label: string
  items: NavbarItem[]
  leading?: React.ReactNode
  trailing?: React.ReactNode
  onNavigate?: (item: NavbarItem, event: React.MouseEvent<HTMLAnchorElement>) => void
  code?: string
}) {
  return (
    <nav data-kit="navbar" aria-label={label} {...props}>
      {/* The nav measures itself; the row inside it is what rearranges. */}
      <div data-kit="navbar-bar">
        {leading != null && <div data-kit="navbar-leading">{leading}</div>}
        {/* A list without bullets stops being announced as one in some
            screen readers, so the role is stated. */}
        <ul data-kit="navbar-links" role="list">
          {items.map((item) => (
            <li key={item.href} data-kit="navbar-item">
              <a
                data-kit="navbar-link"
                data-press-flash=""
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                onClick={onNavigate && ((event) => onNavigate(item, event))}
              >
                {item.icon}
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        {trailing != null && <div data-kit="navbar-trailing">{trailing}</div>}
        <span data-kit="navbar-code" data-micro aria-hidden>
          {code}
        </span>
      </div>
    </nav>
  )
}

// A status readout for the ends of a Navbar: a label and what it reads.
//
// - `tone` colors the value: "signal" for a plain reading, "ok" for standing
//   that's good, "flag" for the one to look at (credits).
// - `progress`, from 0 to 1, draws a meter under it: how far along the value
//   is to its next step. It's announced as "<label> progress".
// - `hideLabel` keeps the label for screen readers only, for a value that
//   says what it is by itself ("¤ 15 240").
function NavbarReadout({
  label,
  value,
  tone = "signal",
  progress,
  hideLabel,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  label: string
  value: React.ReactNode
  tone?: ReadoutTone
  progress?: number
  hideLabel?: boolean
}) {
  const filled = progress == null ? null : Math.min(1, Math.max(0, progress))
  return (
    <span data-kit="navbar-readout" data-tone={tone} {...props}>
      <span data-kit="navbar-readout-label" data-sr-only={hideLabel ? "" : undefined}>
        {label}
      </span>{" "}
      <span data-kit="navbar-readout-value">{value}</span>
      {filled != null && (
        <span
          data-kit="navbar-readout-meter"
          role="meter"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(filled * 100)}
          style={{ "--value": filled } as React.CSSProperties}
        />
      )}
    </span>
  )
}

export { Navbar, NavbarReadout }
export type { NavbarItem }
