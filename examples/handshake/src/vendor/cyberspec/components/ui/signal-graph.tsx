import * as React from "react"
import { fxMoves } from "#src/vendor/cyberspec/lib/fx.ts"
import "#src/vendor/cyberspec/components/ui/cyber/signal-graph.css"

type Tone = "signal" | "accent" | "flag" | "ok"

// The drawing's own units. It's stretched to whatever box it's given, so
// only the proportions matter; strokes are kept a constant width in CSS.
const W = 100
const H = 40
const pad = 2

// A compact graph of a run of samples: a trace ("line") or a spectrum of
// bars, over a baseline grid, with the latest sample on a readout.
//
// - `data`: the samples, oldest first.
// - `min` and `max` fix the scale. Without them it runs from zero (or the
//   lowest sample, if that's negative) to the highest, which jumps about
//   when the data is live, so give live graphs a scale.
// - `live`: the data is a moving window. Pass a new array as samples
//   arrive and they scroll in from the end rather than jumping; with FX
//   off they simply appear. The mark on the newest sample breathes.
//
// The drawing is hidden from assistive technology, which gets the label
// and a sentence instead: the latest, lowest and highest values.
function SignalGraph({
  label,
  data,
  variant = "line",
  unit,
  precision = 0,
  min,
  max,
  live,
  tone = "signal",
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: string
  data: number[]
  variant?: "line" | "bars"
  unit?: string
  precision?: number
  min?: number
  max?: number
  live?: boolean
  tone?: Tone
}) {
  const id = React.useId()
  const plot = React.useRef<SVGGElement>(null)
  const arrived = React.useRef(0)

  // The sample that just fell off the start is kept for one more window,
  // drawn a step before the first, so the trace has something to scroll
  // out as well as in.
  const [shown, setShown] = React.useState<{ data: number[]; ghost: number | null }>({ data, ghost: null })
  if (shown.data !== data) setShown({ data, ghost: live && shown.data.length === data.length ? (shown.data[0] ?? null) : null })
  const ghost = shown.data === data ? shown.ghost : null

  const count = data.length
  const latest = count ? data[count - 1] : null
  const lowest = count ? Math.min(...data) : 0
  const highest = count ? Math.max(...data) : 0
  const floor = min ?? Math.min(0, lowest)
  const ceiling = Math.max(max ?? highest, floor + Number.EPSILON)
  const level = (value: number) => Math.max(0, Math.min(1, (value - floor) / (ceiling - floor)))
  const step = variant === "line" ? W / Math.max(1, count - 1) : W / Math.max(1, count)

  React.useLayoutEffect(() => {
    const node = plot.current
    const now = performance.now()
    const since = now - arrived.current
    arrived.current = now
    if (!node || !live || ghost == null || !fxMoves()) return
    // As long as the last gap between samples, so a steady feed scrolls
    // without stopping; a first or a late sample just slides in.
    const duration = since > 80 && since < 2000 ? since : 320
    const slide = node.animate([{ transform: `translateX(${step}px)` }, { transform: "translateX(0)" }], { duration, easing: "linear" })
    return () => slide.cancel()
  }, [data, ghost, live, step])

  const samples = ghost == null ? data.map((value, index) => ({ value, at: index })) : [{ value: ghost, at: -1 }, ...data.map((value, index) => ({ value, at: index }))]
  const y = (value: number) => H - pad - level(value) * (H - pad * 2)
  const points = samples.map((sample) => `${(sample.at * step).toFixed(2)},${y(sample.value).toFixed(2)}`)
  const first = samples.length ? samples[0]!.at * step : 0

  const format = (value: number) => value.toFixed(precision)
  const summary = latest == null ? "No samples." : `Latest ${format(latest)}${unit ? ` ${unit}` : ""}. Lowest ${format(lowest)}, highest ${format(highest)}.`

  return (
    <div data-kit="signal-graph" data-variant={variant} data-tone={tone} data-live={live ? "" : undefined} role="group" aria-labelledby={id} {...props}>
      <div data-kit="signal-graph-head">
        <span data-kit="label" id={id}>
          {label}
        </span>
        <span data-kit="signal-graph-value" aria-hidden>
          {latest == null ? "--" : format(latest)}
          {unit && <span data-kit="signal-graph-unit">{unit}</span>}
        </span>
      </div>
      <span data-sr-only>{summary}</span>
      <div data-kit="signal-graph-plot" aria-hidden>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" focusable="false">
          <g ref={plot}>
            {variant === "line" && count > 1 && (
              <>
                <polygon data-kit="signal-graph-area" points={`${first.toFixed(2)},${H} ${points.join(" ")} ${W},${H}`} />
                <polyline data-kit="signal-graph-trace" points={points.join(" ")} />
              </>
            )}
            {variant === "bars" &&
              samples.map((sample) => (
                <rect
                  key={sample.at}
                  data-kit="signal-graph-bar"
                  data-latest={sample.at === count - 1 ? "" : undefined}
                  x={(sample.at * step + step * 0.15).toFixed(2)}
                  width={(step * 0.7).toFixed(2)}
                  y={(H - Math.max(0.6, level(sample.value) * H)).toFixed(2)}
                  height={Math.max(0.6, level(sample.value) * H).toFixed(2)}
                />
              ))}
          </g>
        </svg>
        {variant === "line" && latest != null && <span data-kit="signal-graph-head-mark" style={{ "--graph-head": level(latest) } as React.CSSProperties} />}
        <span data-micro data-kit="signal-graph-scale" data-end="max">
          {format(ceiling)}
        </span>
        <span data-micro data-kit="signal-graph-scale" data-end="min">
          {format(floor)}
        </span>
      </div>
    </div>
  )
}

export { SignalGraph }
export type { Tone as SignalGraphTone }
