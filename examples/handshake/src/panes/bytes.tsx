/**
 * A packet's bytes as a hex dump: offset, hex and ASCII, each byte coloured by the layer it belongs to, so the
 * encapsulation is visible at a glance. The field lit in the dissection lights here; pointing at a byte (or moving
 * the cursor with the arrow keys) lights its field there. A decrypted QUIC Initial can be shown as it was on the
 * wire or as plaintext.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { definePane, type PaneProps } from "jali-layout/react";
import { Binary } from "lucide-react";
import { SegmentedControl } from "#src/vendor/cyberspec/components/ui/segmented-control.tsx";
import { printable } from "#src/packets/bytes.ts";
import { byteIndex } from "#src/packets/fields.ts";
import { highlightKey, setHighlight } from "#src/packets/highlight.ts";
import { followPacket, PacketGate, PacketHead, useHighlight } from "./parts/capture";
import { PaneBody } from "./parts/states";
import { LAYER_NAMES, LAYERS, type Capture, type Packet } from "#src/packets/types.ts";

const bytesParams = { capture: String, n: Number };

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function BytesView({ params, openHere }: PaneProps<typeof bytesParams>) {
  return (
    <PaneBody className="pk-bytes">
      <PacketGate {...params} onOpened={(capture) => openHere(bytes({ ...params, capture }))}>
        {(capture, p) => <Dump capture={capture} p={p} />}
      </PacketGate>
    </PaneBody>
  );
}

function Dump({ capture, p }: { capture: Capture; p: Packet }) {
  const key = highlightKey(capture.id, p.n);
  const lit = useHighlight(key);
  const index = byteIndex(p);
  const [mode, setMode] = useState<"wire" | "plain">("wire");
  const data = mode === "plain" && p.plain ? p.plain : p.data;
  const [cursor, setCursor] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // 16 bytes a row when there is room for 72 columns of mono, 8 otherwise.
  const perRow = width >= 560 ? 16 : 8;
  const field = lit ? index.byId.get(lit) : undefined;
  const inLit = (i: number) =>
    field ? i >= field.offset && i < field.offset + field.length : false;
  const present = LAYERS.filter((l) => index.layer.includes(l));

  const point = (i: number) => setHighlight(key, index.field[i] ?? null);
  const moveCursor = (i: number) => {
    const at = Math.max(0, Math.min(data.length - 1, i));
    setCursor(at);
    point(at);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: perRow,
      ArrowUp: -perRow,
      l: 1,
      h: -1,
      j: perRow,
      k: -perRow,
    };
    // The first key puts the cursor on the lit field's first byte (or the first byte); later keys move it.
    if (e.key in step)
      moveCursor(cursor === null ? (field?.offset ?? 0) : cursor + (step[e.key] ?? 0));
    else if (e.key === "Home") moveCursor(0);
    else if (e.key === "End") moveCursor(data.length - 1);
    else if (e.key === "Escape" && cursor !== null) {
      setCursor(null);
      setHighlight(key, null);
    } else return;
    e.preventDefault();
  };

  const rows: number[] = [];
  for (let o = 0; o < data.length; o += perRow) rows.push(o);
  const at = cursor ?? undefined;
  const status =
    at !== undefined && index.field[at] ? index.byId.get(index.field[at] ?? "") : field;

  return (
    <>
      <PacketHead
        capture={capture}
        p={p}
        detail={`${data.length} bytes captured`}
        className="pk-bytes-head"
      />
      {p.plain ? (
        <SegmentedControl
          label="Show the bytes"
          options={[
            { value: "wire", label: "On the wire" },
            { value: "plain", label: "Decrypted" },
          ]}
          value={mode}
          onValueChange={(v) => setMode(v === "plain" ? "plain" : "wire")}
          hint="The QUIC Initial's header protection removed and payload decrypted, at the same offsets."
        />
      ) : null}
      <ul className="pk-legend" aria-label="Layer colours">
        {present.map((l) => (
          <li key={l} className="pk-layer-chip" data-layer={l}>
            {LAYER_NAMES[l]}
          </li>
        ))}
      </ul>
      <div
        ref={ref}
        className="pk-hex"
        role="group"
        tabIndex={0}
        aria-label={`Bytes of packet ${p.n}. Arrow keys move through them; each byte lights its field in the dissection.`}
        aria-describedby={`${key}-status`}
        data-per-row={perRow}
        onKeyDown={onKeyDown}
      >
        {rows.map((o) => (
          <div key={o} className="pk-hex-row">
            <span className="pk-hex-off" aria-hidden>
              {o.toString(16).padStart(4, "0")}
            </span>
            <span className="pk-hex-bytes" aria-hidden>
              {Array.from(data.subarray(o, o + perRow), (b, k) => {
                const i = o + k;
                return (
                  <span
                    key={i}
                    data-layer={index.layer[i]}
                    data-lit={inLit(i) ? "" : undefined}
                    data-cursor={i === at ? "" : undefined}
                    onPointerEnter={() => point(i)}
                    onClick={() => moveCursor(i)}
                  >
                    {hex2(b)}
                  </span>
                );
              })}
            </span>
            <span className="pk-hex-ascii" aria-hidden>
              {Array.from(data.subarray(o, o + perRow), (b, k) => {
                const i = o + k;
                return (
                  <span
                    key={i}
                    data-layer={index.layer[i]}
                    data-lit={inLit(i) ? "" : undefined}
                    data-cursor={i === at ? "" : undefined}
                  >
                    {printable(b)}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>
      <p
        id={`${key}-status`}
        className="pk-bytes-status"
        data-hint={status ? undefined : ""}
        aria-live="polite"
      >
        {status
          ? `${at !== undefined ? `Byte ${at} (0x${hex2(data[at] ?? 0)}) · ` : ""}${status.name}${status.value ? ` = ${status.value}` : ""} · ${LAYER_NAMES[status.layer]}`
          : "Point at a byte, or focus here and use the arrow keys, to find its field."}
      </p>
    </>
  );
}

export const bytes = definePane("bytes", {
  params: bytesParams,
  title: ({ n }) => `Bytes · packet ${n}`,
  icon: Binary,
  width: { min: 300, comfortable: 600, max: 760 },
  height: { min: 200 },
  // A list of packets, or a lesson step, selects packet({ capture, n }): show that packet's bytes.
  follow: followPacket,
  Component: BytesView,
});
