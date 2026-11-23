"use client"

import * as React from "react"
import { Ellipsis } from "lucide-react"
import "#src/vendor/cyberspec/components/ui/cyber/breadcrumb.css"

type BreadcrumbItem = {
  label: string
  /** Where the level leads. Without one it's plain text. The last item is the current page and is never a link. */
  href?: string
}

// Where this page sits: a trail of the levels above it, split by a double
// slash, ending in the current page in the signal color.
//
// - `label` names the landmark ("Dossier location"). Keep it unique among
//   the navigation on a screen.
// - `items` run from the top level down. The last one is the current page.
//
// In a narrow column a trail of more than three levels folds its middle
// into a small key; pressing the key unfolds the trail for good and puts
// focus on the first level it brought back.
function Breadcrumb({
  label,
  items,
  ...props
}: Omit<React.ComponentProps<"nav">, "children" | "aria-label"> & {
  label: string
  items: BreadcrumbItem[]
}) {
  const [unfolded, setUnfolded] = React.useState(false)
  const list = React.useRef<HTMLOListElement>(null)
  const last = items.length - 1
  const folds = items.length > 3 && !unfolded

  // The key is gone once it has been pressed, so focus moves to what it
  // revealed rather than falling back to the page.
  React.useEffect(() => {
    if (!unfolded) return
    const revealed = list.current?.querySelector<HTMLElement>("[data-middle] :is(a, [tabindex])")
    revealed?.focus()
  }, [unfolded])

  return (
    <nav data-kit="breadcrumb" aria-label={label} {...props}>
      <ol data-kit="breadcrumb-list" ref={list}>
        {items.map((item, index) => {
          const middle = index > 0 && index < last
          return (
            <React.Fragment key={index}>
              {folds && index === 1 && (
                <li data-kit="breadcrumb-item" data-fold="">
                  <Slash />
                  <button
                    type="button"
                    data-kit="breadcrumb-more"
                    data-frame="br"
                    data-press-flash=""
                    aria-label={`Show ${last - 1} more levels`}
                    onClick={() => setUnfolded(true)}
                  >
                    <Ellipsis aria-hidden />
                  </button>
                </li>
              )}
              <li data-kit="breadcrumb-item" data-middle={middle ? "" : undefined} data-folds={folds && middle ? "" : undefined}>
                {index > 0 && <Slash />}
                {index === last ? (
                  <span data-kit="breadcrumb-current" aria-current="page">
                    {item.label}
                  </span>
                ) : item.href != null ? (
                  <a data-kit="breadcrumb-link" href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  // A level with nowhere to go still takes focus after the
                  // trail unfolds, so the key's press lands somewhere.
                  <span data-kit="breadcrumb-text" tabIndex={middle ? -1 : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

// The divider. It's a drawing of a path, not part of any level's name.
function Slash() {
  return (
    <span data-kit="breadcrumb-slash" aria-hidden>
      {"//"}
    </span>
  )
}

export { Breadcrumb }
export type { BreadcrumbItem }
