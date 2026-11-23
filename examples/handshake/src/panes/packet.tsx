/**
 * One packet, dissected: its headers as a tree, outermost first, each field with its value and its bytes. Moving
 * through the tree (arrows, or a click) lights the field's bytes in the bytes pane and shows, under the tree, what
 * the field is and why it matters. Branches stay open as you move from packet to packet, so the header you were
 * reading stays open in the next one.
 */
import { useMemo, useState } from "react";
import { definePane, useCommands, type PaneProps } from "jali/react";
import { ScanSearch } from "lucide-react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { Tree, type TreeNode } from "#src/vendor/cyberspec/components/ui/tree.tsx";
import { captureTitle } from "#src/packets/captures.ts";
import { hex } from "#src/packets/bytes.ts";
import { byteIndex, pathTo } from "#src/packets/fields.ts";
import { highlightKey, setHighlight } from "#src/packets/highlight.ts";
import { LAYER_NAMES, type Capture, type Field, type Packet } from "#src/packets/types.ts";
import { PacketGate, PacketHead, useHighlight } from "./parts/capture";
import { PaneBody } from "./parts/states";
import { bytes } from "./bytes";
import { layers } from "./layers";

const packetParams = { capture: String, n: Number };

const toNode = (f: Field): TreeNode => ({
  value: f.id,
  label: f.value ? `${f.name}: ${f.value}` : f.name,
  meta: `${f.warn ? "! " : ""}${f.length ? `${f.length} B` : ""}`.trim() || undefined,
  children: f.children?.length ? f.children.map(toNode) : undefined,
});

/** Every branch's id, for "expand all". */
const branches = (fields: readonly Field[]): string[] =>
  fields.flatMap((f) => (f.children?.length ? [f.id, ...branches(f.children)] : []));

function PacketView({ params, openHere, openBeside }: PaneProps<typeof packetParams>) {
  return (
    <PaneBody className="pk-packet">
      <PacketGate {...params} onOpened={(capture) => openHere(packet({ ...params, capture }))}>
        {(capture, p) => <Dissection capture={capture} p={p} openBeside={openBeside} />}
      </PacketGate>
    </PaneBody>
  );
}

function Dissection({
  capture,
  p,
  openBeside,
}: {
  capture: Capture;
  p: Packet;
  openBeside: PaneProps["openBeside"];
}) {
  const key = highlightKey(capture.id, p.n);
  const lit = useHighlight(key);
  const index = byteIndex(p);
  const items = useMemo(() => p.headers.map(toNode), [p]);
  // Open branches by field id: ids are the same for the same protocol in every packet (ip.flags, tcp.options).
  const [open, setOpen] = useState<string[]>(() => {
    const last = [...p.headers].reverse().find((h) => h.proto !== "data" && h.proto !== "frame");
    return last ? [last.id] : [];
  });
  const field = lit ? index.byId.get(lit) : undefined;
  // A field lit from the bytes pane may sit in a closed branch: open the way to it.
  const expanded = useMemo(() => {
    if (!lit) return open;
    const path = pathTo(p, lit).slice(0, -1);
    return path.every((id) => open.includes(id)) ? open : [...new Set([...open, ...path])];
  }, [lit, open, p]);
  const all = useMemo(() => branches(p.headers), [p]);

  useCommands([
    { id: "expand-all", title: "Expand every header", run: () => setOpen(all) },
    { id: "collapse-all", title: "Collapse every header", run: () => setOpen([]) },
    {
      id: "open-bytes",
      title: "Open this packet's bytes beside",
      run: () => openBeside(bytes({ capture: capture.id, n: p.n })),
    },
    {
      id: "open-layers",
      title: "Open this packet's layers beside",
      run: () => openBeside(layers({ capture: capture.id, n: p.n })),
    },
  ]);

  return (
    <>
      <PacketHead
        capture={capture}
        p={p}
        detail={`${p.wireLength} bytes · ${p.rel.toFixed(6)} s`}
        source
      >
        {p.plain ? (
          <Badge
            tone="signal"
            title="The QUIC Initial payload was decrypted here, with keys derived from the connection ID"
          >
            Initial decrypted
          </Badge>
        ) : null}
      </PacketHead>
      <p className="pk-info pk-mono">{p.info}</p>
      {p.analysis.length ? (
        <Alert tone="warning" title={p.analysis.map((a) => a.label).join(", ")}>
          {p.analysis.map((a) => a.why).join(" ")}
        </Alert>
      ) : null}
      <div className="pk-tree-tools">
        {/* One switch: it says what it will do. */}
        {expanded.length >= all.length ? (
          <Button size="sm" tone="ghost" onClick={() => setOpen([])}>
            Collapse all
          </Button>
        ) : (
          <Button size="sm" tone="ghost" onClick={() => setOpen(all)}>
            Expand all
          </Button>
        )}
      </div>
      <Tree
        label={`Packet ${p.n} headers`}
        items={items}
        value={lit}
        activation="automatic"
        expandOnPress={false}
        onValueChange={(v) => setHighlight(key, typeof v === "string" ? v : null)}
        expanded={expanded}
        onExpandedChange={setOpen}
      />
      <FieldNote p={p} field={field} />
    </>
  );
}

/** The lit field, in full: its value, where its bytes are, and why it matters. */
function FieldNote({ p, field }: { p: Packet; field: Field | undefined }) {
  if (!field) {
    return (
      <p className="pk-hint">
        Move through the tree with the arrow keys, or click a field: its bytes light up in the bytes
        pane, and what it means shows here. Right and Left open and close a header.
      </p>
    );
  }
  const raw = field.length
    ? p.data.subarray(field.offset, field.offset + Math.min(field.length, 32))
    : undefined;
  return (
    <Panel
      title={field.name}
      code={`${LAYER_NAMES[field.layer].toUpperCase()} // ${field.length ? `@${field.offset}+${field.length}` : "NO BYTES"}`}
      tone={field.warn ? "flag" : "signal"}
      className="pk-note"
      actions={
        <span className="pk-layer-chip" data-layer={field.layer}>
          {LAYER_NAMES[field.layer]}
        </span>
      }
    >
      {field.value ? <p className="pk-note-value pk-mono">{field.value}</p> : null}
      {raw ? (
        <p className="pk-note-bytes pk-mono">
          {hex(raw, " ")}
          {field.length > 32 ? " …" : ""}{" "}
          <span className="pk-muted">
            · bytes {field.offset}–{field.offset + field.length - 1}
          </span>
        </p>
      ) : (
        <p className="pk-muted">
          No bytes of its own in this packet: computed, or reassembled from earlier ones.
        </p>
      )}
      {field.why ? <p className="pk-note-why">{field.why}</p> : null}
    </Panel>
  );
}

export const packet = definePane("packet", {
  params: packetParams,
  title: ({ capture, n }) => `Packet ${n} · ${captureTitle(capture)}`,
  icon: ScanSearch,
  width: { min: 300, comfortable: 460, max: 760 },
  height: { min: 240 },
  Component: PacketView,
});
