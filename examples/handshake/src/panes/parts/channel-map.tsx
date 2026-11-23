/**
 * The channel map: one band's spectrum as an SVG, each network a trapezoid that spans the channels it occupies,
 * as tall as it is loud. Overlap reads at a glance: shapes standing on the same MHz compete. Your network is drawn
 * in the accent, the suggested block as a dashed outline. The drawing is in pixels (it re-measures its width, and
 * 1 unit is 1 px), so its labels keep the type scale at 360px and at 2000px. It is one tab stop: left and right
 * move between networks, and the selected one is read out below it.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { blocks, nameOf, signalQuality, spanOf, type Block } from "#src/scans/channels.ts";
import type { Band, WifiNetwork } from "#src/scans/types.ts";

const PAD = { left: 40, right: 10, top: 14, bottom: 30 };
const HEIGHT = 250;
const DBM_TOP = -30;
const DBM_BOTTOM = -95;

export interface MapNetwork {
  net: WifiNetwork;
  /** Index in the pane's list, for selection. */
  index: number;
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function axisRange(band: Band, nets: MapNetwork[], suggested?: Block): [number, number] {
  const spans = nets.flatMap((m) => {
    const s = spanOf(m.net);
    return s ? [s] : [];
  });
  if (suggested) spans.push(suggested.span);
  if (band === "2.4") {
    return [
      Math.min(2397, ...spans.map((s) => s.lowMHz - 5)),
      Math.max(2477, ...spans.map((s) => s.highMHz + 5)),
    ];
  }
  const lo = Math.min(...spans.map((s) => s.lowMHz));
  const hi = Math.max(...spans.map((s) => s.highMHz));
  const mid = (lo + hi) / 2;
  const half = Math.max(60, (hi - lo) / 2 + 15);
  return [mid - half, mid + half];
}

export function ChannelMap({
  band,
  nets,
  suggested,
  selected,
  onSelect,
}: {
  band: Band;
  nets: MapNetwork[];
  suggested?: Block;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [lo, hi] = axisRange(band, nets, suggested);
  const plotW = Math.max(40, width - PAD.left - PAD.right);
  const base = HEIGHT - PAD.bottom;
  const x = (mhz: number) => PAD.left + ((mhz - lo) / (hi - lo)) * plotW;
  const y = (dbm: number) =>
    base -
    ((Math.min(DBM_TOP, Math.max(DBM_BOTTOM, dbm)) - DBM_BOTTOM) / (DBM_TOP - DBM_BOTTOM)) *
      (base - PAD.top);

  // Channel ticks, thinned so two labels are never closer than 30 px.
  const ticks: { ch: number; at: number }[] = [];
  for (const b of blocks(band, 20)) {
    const at = x((b.span.lowMHz + b.span.highMHz) / 2);
    if (at >= PAD.left - 1 && at <= width - PAD.right + 1) ticks.push({ ch: b.primary, at });
  }
  let lastLabel = -100;
  const labelled = new Set<number>();
  for (const t of ticks) {
    if (t.at - lastLabel >= 30) {
      labelled.add(t.ch);
      lastLabel = t.at;
    }
  }

  const sel = nets.find((m) => m.index === selected) ?? nets[0];
  const order = nets.map((m) => m.index);
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const at = Math.max(0, order.indexOf(sel?.index ?? -1));
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? at + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? order.length - 1
              : undefined;
    if (next === undefined) return;
    e.preventDefault();
    onSelect(order[Math.min(order.length - 1, Math.max(0, next))] ?? selected);
  };

  const q = sel?.net.signalDbm !== undefined ? signalQuality(sel.net.signalDbm) : undefined;

  return (
    <div className="map" ref={box}>
      <div
        className="map-focus"
        role="group"
        tabIndex={0}
        aria-label={`Channel map, ${band} GHz, ${nets.length} networks. Left and right arrows move between networks.`}
        onKeyDown={onKey}
      >
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            aria-hidden
            focusable="false"
            className="map-svg"
          >
            {[-90, -70, -50].map((d) => (
              <g key={d}>
                <line
                  className="map-grid"
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(d)}
                  y2={y(d)}
                />
                <text className="map-tick" x={PAD.left - 6} y={y(d) + 4} textAnchor="end">
                  {d}
                </text>
              </g>
            ))}
            <line className="map-axis" x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} />
            {ticks.map((t) => (
              <g key={t.ch}>
                <line className="map-axis" x1={t.at} x2={t.at} y1={base} y2={base + 4} />
                {labelled.has(t.ch) ? (
                  <text className="map-tick" x={t.at} y={base + 18} textAnchor="middle">
                    {t.ch}
                  </text>
                ) : null}
              </g>
            ))}
            <text className="map-tick" x={PAD.left - 6} y={PAD.top - 3} textAnchor="end">
              dBm
            </text>
            <text className="map-tick" x={PAD.left - 6} y={base + 18} textAnchor="end">
              ch
            </text>

            {suggested ? (
              <g>
                <rect
                  className="map-suggest"
                  x={x(suggested.span.lowMHz)}
                  y={PAD.top}
                  width={Math.max(2, x(suggested.span.highMHz) - x(suggested.span.lowMHz))}
                  height={base - PAD.top}
                />
                <text
                  className="map-suggest-label"
                  x={(x(suggested.span.lowMHz) + x(suggested.span.highMHz)) / 2}
                  y={PAD.top + 12}
                  textAnchor="middle"
                >
                  suggested
                </text>
              </g>
            ) : null}

            {[...nets]
              .sort(
                (a, b) =>
                  Number(a.index === selected) - Number(b.index === selected) ||
                  (a.net.signalDbm ?? -75) - (b.net.signalDbm ?? -75),
              )
              .map((m) => {
                const s = spanOf(m.net);
                if (!s) return null;
                const x0 = x(s.lowMHz);
                const x1 = x(s.highMHz);
                const top = y(m.net.signalDbm ?? -75);
                const slope = Math.min(10, (x1 - x0) * 0.14);
                const w = x1 - x0;
                const label = nameOf(m.net);
                // About 6 px a character at the label size; show it only where it fits inside the shape.
                const fit = Math.floor((w - 6) / 6);
                const text =
                  fit >= 4 ? (label.length > fit ? `${label.slice(0, fit - 1)}…` : label) : "";
                const isSel = m.index === selected;
                return (
                  <g
                    key={m.index}
                    className="map-net"
                    data-current={m.net.current ? "" : undefined}
                    data-selected={isSel ? "" : undefined}
                    data-unknown={m.net.signalDbm === undefined ? "" : undefined}
                    onClick={() => onSelect(m.index)}
                  >
                    <path
                      d={`M${x0},${base} L${x0 + slope},${top} L${x1 - slope},${top} L${x1},${base} Z`}
                    />
                    {text ? (
                      <text className="map-name" x={(x0 + x1) / 2} y={top - 5} textAnchor="middle">
                        {text}
                      </text>
                    ) : null}
                  </g>
                );
              })}
          </svg>
        ) : null}
      </div>
      <p className="map-read" aria-live="polite">
        {sel ? (
          <>
            <b>{nameOf(sel.net)}</b>
            {sel.net.current ? " (you)" : ""} · channel {sel.net.channel} · {sel.net.widthMHz}
            {sel.net.widthEstimated ? " (guessed)" : ""} MHz ·{" "}
            {sel.net.signalDbm !== undefined
              ? `${sel.net.signalDbm} dBm${q ? `, ${q.label.toLowerCase()}` : ""}`
              : "signal not reported"}
            {sel.net.redacted ? " · name hidden by macOS" : ""}
          </>
        ) : (
          "No networks in this band."
        )}
      </p>
    </div>
  );
}
