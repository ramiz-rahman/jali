/**
 * The ladder diagram itself, shared by the ladder pane and the comparison: the capturing host's lifeline on the
 * left, the other side's on the right, one sloped arrow per packet, the handshake's round trips shaded, and the
 * moment the request can leave marked. One tab stop: J/K or the arrows move between packets and pick them. It is
 * as wide as its box and grows down, never sideways.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LadderModel } from "#src/packets/ladder.ts";

const AXIS = 58;
const SLANT = 12;
const MIN_GAP = 30;
/** px per ms of capture time between arrows, up to MAX_GAP; longer pauses are drawn as a break. */
const PX_PER_MS = 1.1;
const MAX_GAP = 46;
const BREAK = 0.2;

const ms = (s: number) => (s >= 1 ? `${s.toFixed(2)} s` : `${(s * 1000).toFixed(1)} ms`);

interface Placed {
  n: number;
  y: number;
  gapBefore?: number;
}

function place(model: LadderModel): { rows: Placed[]; height: number } {
  let y = 34;
  const rows: Placed[] = [];
  model.arrows.forEach((a, i) => {
    const prev = model.arrows[i - 1];
    const dt = prev ? a.t - prev.t : 0;
    if (prev) y += dt > BREAK ? MIN_GAP + 26 : MIN_GAP + Math.min(MAX_GAP, dt * 1000 * PX_PER_MS);
    rows.push({ n: a.n, y, gapBefore: dt > BREAK ? dt : undefined });
  });
  return { rows, height: y + 28 };
}

/** An arrowhead at (x2, y2), pointing along the line from (x1, y1). */
function head(x1: number, y1: number, x2: number, y2: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number, s: number) =>
    `${x2 - 8 * Math.cos(a + s * d)},${y2 - 8 * Math.sin(a + s * d)}`;
  return `${x2},${y2} ${p(0.45, 1)} ${p(0.45, -1)}`;
}

/** The diagram: shared by this pane and the comparison. */
export function LadderDiagram({
  model,
  current,
  onPick,
  label,
  idPrefix,
}: {
  model: LadderModel;
  current?: number;
  onPick: (n: number) => void;
  label: string;
  idPrefix: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(260, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const { rows, height } = useMemo(() => place(model), [model]);
  const xL = AXIS + 8;
  const xR = width - 12;
  const maxChars = Math.max(10, Math.floor((xR - xL - 24) / 6.6));
  const yOf = (n: number) => rows.find((r) => r.n === n)?.y ?? 0;
  const at = model.arrows.findIndex((a) => a.n === current);
  const optionId = (n: number) => `${idPrefix}-arrow-${n}`;

  // Keep the current packet's arrow in view when a list or a lesson moves it.
  useEffect(() => {
    if (current === undefined) return;
    box.current
      ?.querySelector(`#${CSS.escape(`${idPrefix}-arrow-${current}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [current, idPrefix]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const step =
      e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0;
    if (step) {
      const next =
        model.arrows[Math.max(0, Math.min(model.arrows.length - 1, (at < 0 ? -1 : at) + step))];
      if (next) onPick(next.n);
    } else if (e.key === "Home" && model.arrows[0]) onPick(model.arrows[0].n);
    else if (e.key === "End" && model.arrows.at(-1)) onPick(model.arrows.at(-1)?.n ?? 0);
    else return;
    e.preventDefault();
  };

  const request = model.request;
  const rtt = model.rtt;
  return (
    <div className="pk-ladder" ref={box}>
      <div className="pk-ladder-cols" aria-hidden>
        <span>{model.left}</span>
        <span>{model.right}</span>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={current !== undefined && at >= 0 ? optionId(current) : undefined}
        onKeyDown={onKeyDown}
      >
        <line x1={xL} x2={xL} y1={10} y2={height - 6} className="pk-ladder-life" />
        <line x1={xR} x2={xR} y1={10} y2={height - 6} className="pk-ladder-life" />
        {model.phases.map((ph, i) => {
          const y1 = yOf(ph.from) - SLANT - 18;
          const y2 = yOf(ph.to) + 8;
          return (
            <g key={ph.label} className="pk-ladder-phase" aria-hidden>
              <rect x={xL} y={y1} width={xR - xL} height={y2 - y1} />
              <text x={xL + 6} y={y1 + 12}>
                RTT {i + 1} · {ph.label}
              </text>
            </g>
          );
        })}
        {rows.map((r) =>
          r.gapBefore ? (
            <text
              key={`gap${r.n}`}
              x={(xL + xR) / 2}
              y={r.y - MIN_GAP + 2}
              className="pk-ladder-break"
              textAnchor="middle"
              aria-hidden
            >
              ⋯ {ms(r.gapBefore)} later ⋯
            </text>
          ) : null,
        )}
        {request !== undefined && rtt ? (
          <g className="pk-ladder-request" aria-hidden>
            <line x1={xL} x2={xR} y1={yOf(request) + 3} y2={yOf(request) + 3} />
            <text x={xL + 6} y={yOf(request) + 17}>
              request leaves · {model.phases.length} RTT
            </text>
          </g>
        ) : null}
        {model.arrows.map((a) => {
          const y = yOf(a.n);
          const [x1, y1, x2, y2] = a.out ? [xL, y, xR, y + SLANT] : [xR, y - SLANT, xL, y];
          const text =
            a.peer && !a.out
              ? `${a.label} · ${a.peer}`
              : a.peer
                ? `${a.label} → ${a.peer}`
                : a.label;
          const short = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
          const kind =
            a.n === current ? "current" : a.flagged ? "flag" : a.encrypted ? "crypt" : "plain";
          return (
            <g
              key={a.n}
              id={optionId(a.n)}
              role="option"
              aria-selected={a.n === current}
              className="pk-ladder-arrow"
              data-kind={kind}
              onClick={() => onPick(a.n)}
            >
              {/* The option's name, and a tooltip: a title, since the visible label may be cut short. */}
              <title>{`Packet ${a.n}, ${a.out ? "sent" : "received"}: ${text}, at ${ms(a.t)}`}</title>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="pk-ladder-hit" />
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="pk-ladder-line" />
              <polygon points={head(x1, y1, x2, y2)} className="pk-ladder-head" />
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 6}
                textAnchor="middle"
                className="pk-ladder-label"
              >
                {short}
              </text>
              <text x={AXIS} y={y + 4} textAnchor="end" className="pk-ladder-time">
                {ms(a.t)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
