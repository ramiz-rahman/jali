import * as React from "react"
import { Button as SdkButton } from "@ui-sdk/react/button"
import { Plus } from "lucide-react"
import { burst } from "#src/vendor/cyberspec/lib/glitch.ts"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import "#src/vendor/cyberspec/components/ui/cyber/hex-stat.css"

// One attribute, as a node on a lattice: a flat-topped hexagon holding its
// name, an icon and its value. It's a button, pressed while `selected`, and
// a signal bar along its top edge marks the selected one.
//
// - `onRaise` adds a small "+" key on its lower edge, a separate button
//   named "Raise <name>". Leave it out when there's nothing to spend; it
//   also goes once `value` reaches `max`.
// - When `value` changes, the numeral slips its channels for a moment.
//
// Everything else goes to the node's button (`onClick`, `disabled`, …).
function HexStat({
  name,
  value,
  icon,
  selected = false,
  max,
  onRaise,
  ...props
}: Omit<React.ComponentProps<typeof SdkButton>, "children" | "name" | "value"> & {
  name: string
  value: number
  icon?: React.ReactNode
  selected?: boolean
  max?: number
  /** Return false if the increase is refused. */
  onRaise?: () => boolean | void
}) {
  const numeral = React.useRef<HTMLSpanElement>(null)
  const last = React.useRef(value)
  React.useEffect(() => {
    if (last.current === value) return
    last.current = value
    if (numeral.current) burst(numeral.current, 300)
  }, [value])

  const raisable = Boolean(onRaise) && (max == null || value < max) && !props.disabled

  return (
    <span data-kit="hex-stat" data-selected={selected ? "" : undefined} data-raisable={raisable ? "" : undefined}>
      <SdkButton data-kit="hex-stat-node" aria-pressed={selected} {...props}>
        <span data-kit="hex-stat-face">
          <span data-kit="hex-stat-name">{name}</span>{" "}
          <span data-kit="hex-stat-reading">
            {icon && (
              <span data-kit="hex-stat-icon" aria-hidden>
                {icon}
              </span>
            )}
            <span ref={numeral} data-kit="hex-stat-value">
              {value}
            </span>
            {max != null && <span data-sr-only> of {max}</span>}
          </span>
        </span>
      </SdkButton>
      {raisable && (
        <SdkButton
          data-kit="hex-stat-raise"
          data-frame="tl br"
          data-press-flash=""
          data-sfx="none"
          aria-label={`Raise ${name}`}
          onClick={() => {
            if (raisable && onRaise && onRaise() !== false) sfx("increment")
          }}
        >
          <Plus aria-hidden />
        </SdkButton>
      )}
    </span>
  )
}

// A flat-topped hexagon 100 wide is this tall.
const hexHeight = 86.6

type Point = { x: number; y: number }

// Where each node sits. Columns step three quarters of a hexagon across
// and odd columns ride half a step higher, which is what makes it a
// honeycomb. A short last row spreads across the width instead of bunching
// at the start, so five nodes in three columns leave the middle cell empty.
function lattice(count: number, columns: number, gap: number) {
  const dx = 75 + gap * 0.866
  const dy = hexHeight + gap
  const rows = Math.max(1, Math.ceil(count / columns))
  const at = (column: number, row: number): Point => ({ x: column * dx, y: row * dy + (columns > 1 && column % 2 === 0 ? dy / 2 : 0) })
  const taken = new Set<string>()
  const nodes: Point[] = []
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / columns)
    const inRow = row === rows - 1 ? count - row * columns : columns
    let column = index - row * columns
    if (inRow < columns) column = inRow === 1 ? Math.floor((columns - 1) / 2) : Math.round((column * (columns - 1)) / (inRow - 1))
    taken.add(`${column}:${row}`)
    nodes.push(at(column, row))
  }
  // A cell left empty becomes a hub, if nodes border it on most sides.
  // With fewer it would be a junction hanging off the edge of the lattice.
  const hubs: Point[] = []
  for (let column = 0; column < columns; column++) {
    if (taken.has(`${column}:${rows - 1}`)) continue
    const hub = at(column, rows - 1)
    if (nodes.filter((node) => Math.hypot(node.x - hub.x, node.y - hub.y) < dy * 1.05).length >= 4) hubs.push(hub)
  }
  const all = [...nodes, ...hubs]
  // Whichever columns ride high, the lattice starts at its own top edge.
  const top = all.length ? Math.min(...all.map((point) => point.y)) : 0
  for (const point of all) point.y -= top
  return {
    nodes,
    hubs,
    reach: dy * 1.05,
    width: Math.max(0, ...all.map((point) => point.x)) + 100,
    height: Math.max(0, ...all.map((point) => point.y)) + hexHeight,
  }
}

// How wide the lattice is in hexagon widths, without laying it out.
const span = (count: number, columns: number, gap: number) => ((Math.min(count, columns) - 1) * (75 + gap * 0.866) + 100) / 100

// Three parallel traces from one center toward another, starting `from`
// and stopping `to` units short of each. The outer two give up partway
// and end in a pad, the way a bus thins out on a board.
function traces(a: Point, b: Point, from: number, to: number) {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  const ux = (b.x - a.x) / length
  const uy = (b.y - a.y) / length
  const point = (along: number, across: number) => `${(a.x + ux * along - uy * across).toFixed(1)} ${(a.y + uy * along + ux * across).toFixed(1)}`
  const end = length - to
  const short = from + (end - from) * 0.62
  const pad = (along: number, across: number) => `M${point(along - 1.4, across)}L${point(along + 1.4, across)}`
  return {
    lines: `M${point(from, 0)}L${point(end, 0)}M${point(from, -5)}L${point(short, -5)}M${point(from, 5)}L${point(short, 5)}`,
    pads: `${pad(short, -5)}${pad(short, 5)}`,
  }
}

// Several nodes in a honeycomb, joined by thin circuit traces: short buses
// between neighbors, and a hub in any cell the layout leaves empty. The
// traces that reach the selected node light in the signal color.
//
// It's a labelled group of buttons. It uses `columns` across while a
// hexagon stays at least `minSize` px wide, and fewer when it wouldn't, so
// a narrow column gets two tall columns rather than three cramped ones.
//
// Children are `HexStat`s; the group reads each one's `selected` to light
// the traces.
function HexStatGroup({
  label,
  columns = 3,
  gap = 16,
  minSize = 92,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  label: string
  columns?: number
  gap?: number
  minSize?: number
}) {
  const root = React.useRef<HTMLDivElement>(null)
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const count = items.length
  const [fit, setFit] = React.useState(columns)

  React.useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    const measure = () => {
      let next = Math.max(1, columns)
      while (next > 1 && node.clientWidth / span(count, next, gap) < minSize) next--
      setFit(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [columns, count, gap, minSize])

  const { nodes, hubs, reach, width, height } = React.useMemo(() => lattice(count, Math.max(1, fit), gap), [count, fit, gap])
  const center = (point: Point): Point => ({ x: point.x + 50, y: point.y + hexHeight / 2 })
  const lit = items.map((item) => Boolean((item.props as { selected?: boolean }).selected))
  const apothem = hexHeight / 2

  const links: { key: string; lit: boolean; lines: string; pads: string }[] = []
  nodes.forEach((a, i) => {
    nodes.forEach((b, j) => {
      if (j <= i || Math.hypot(b.x - a.x, b.y - a.y) > reach) return
      links.push({ key: `${i}-${j}`, lit: lit[i] || lit[j] || false, ...traces(center(a), center(b), apothem - 1, apothem - 1) })
    })
  })
  hubs.forEach((hub, h) => {
    nodes.forEach((node, i) => {
      if (Math.hypot(node.x - hub.x, node.y - hub.y) > reach) return
      links.push({ key: `h${h}-${i}`, lit: lit[i] ?? false, ...traces(center(hub), center(node), 13, apothem - 1) })
    })
  })

  return (
    <div ref={root} data-kit="hex-stat-group" role="group" aria-label={label} {...props}>
      <div data-kit="hex-stat-lattice" style={{ "--lattice-span": width / 100, "--lattice-ratio": `${width} / ${height}` } as React.CSSProperties}>
        <svg data-kit="hex-stat-traces" viewBox={`0 0 ${width.toFixed(1)} ${height.toFixed(1)}`} preserveAspectRatio="none" aria-hidden focusable="false">
          {links.map((link) => (
            <g key={link.key} data-lit={link.lit ? "" : undefined}>
              <path d={link.lines} />
              <path d={link.pads} data-pad="" />
            </g>
          ))}
          {hubs.map((hub, h) => {
            const c = center(hub)
            return (
              <path
                key={h}
                data-hub=""
                data-lit={lit.some(Boolean) ? "" : undefined}
                d={`M${c.x} ${c.y - 10}L${c.x + 10} ${c.y}L${c.x} ${c.y + 10}L${c.x - 10} ${c.y}ZM${c.x} ${c.y - 4}L${c.x + 4} ${c.y}L${c.x} ${c.y + 4}L${c.x - 4} ${c.y}Z`}
              />
            )
          })}
        </svg>
        {items.map((item, index) => (
          <span
            key={item.key ?? index}
            data-kit="hex-stat-cell"
            style={
              {
                "--cell-x": `${(nodes[index]!.x / width) * 100}%`,
                "--cell-y": `${(nodes[index]!.y / height) * 100}%`,
                "--cell-w": `${(100 / width) * 100}%`,
              } as React.CSSProperties
            }
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export { HexStat, HexStatGroup }
