/**
 * The packet list: every packet of a capture, as Wireshark's top pane lists them (No., Time, Source, Destination,
 * Protocol, Length, Info), with a display filter and TCP analysis rows flagged. Captures run to thousands of packets,
 * so only the rows in view are drawn. J/K and the arrows move the cursor, which is the selection: the dissection,
 * bytes, layers and ladder panes beside it follow. Enter opens the dissection, Space peeks; a capture of your own
 * opens by button or by dropping the file on the pane.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  useTitle,
  type PaneProps,
} from "jali/react";
import { keyHint, type ObjectRef } from "jali";
import { Rows3 } from "lucide-react";
import { Collapsible } from "#src/vendor/cyberspec/components/ui/collapsible.tsx";
import { Select } from "#src/vendor/cyberspec/components/ui/select.tsx";
import { TextField } from "#src/vendor/cyberspec/components/ui/text-field.tsx";
import { CAPTURES, captureTitle, DEFAULT_COMPARISON } from "#src/packets/captures.ts";
import { topLayer } from "#src/packets/fields.ts";
import { parseFilter } from "#src/packets/filter.ts";
import type { Capture, Packet } from "#src/packets/types.ts";
import { CaptureGate, OpenButton, Provenance, RecordSteps, useOpenCapture } from "./parts/capture";
import { openFollower } from "./parts/lab";
import { bare, listMove } from "./parts/list-keys";
import { Empty } from "./parts/states";
import { useVirtualRows } from "./parts/virtual-rows";
import { bytes } from "./bytes";
import { compare } from "./compare";
import { ladder } from "./ladder";
import { layers } from "./layers";
import { packet } from "./packet";

const packetsParams = { capture: String };

/** Row heights match `--pk-row` in styles/packets/list.css. */
const ROWS = { wide: 28, narrow: 46, narrowBelow: 560, overscan: 12 };

const isRetransmission = (p: Packet) =>
  p.analysis.some((a) => a.kind === "retransmission" || a.kind === "fast-retransmission");
const isFlagged = (p: Packet) => p.analysis.length > 0;

function PacketList(pane: PaneProps<typeof packetsParams>) {
  const { params, openHere } = pane;
  const show = (capture: string) => openHere(packets({ capture }));
  const file = useOpenCapture(show);
  return (
    <div className="pane-body pk-list" {...file.dropProps}>
      {file.input}
      <CaptureGate id={params.capture} onOpened={show}>
        {(capture) => (
          <ListBody capture={capture} pane={pane} pickFile={file.pick} fileError={file.error} />
        )}
      </CaptureGate>
      <p className="pk-drop" aria-hidden>
        Drop a .pcap or .pcapng to open it
      </p>
    </div>
  );
}

function ListBody({
  capture,
  pane,
  pickFile,
  fileError,
}: {
  capture: Capture;
  pane: PaneProps<typeof packetsParams>;
  pickFile: () => void;
  fileError?: string;
}) {
  const { node, focused, select, peek, openHere, openBeside } = pane;
  const jali = useJali();
  const [filterText, setFilterText] = usePaneState("filter", "", {
    parse: (v) => (typeof v === "string" ? v : undefined),
  });
  const filter = useMemo(() => parseFilter(filterText), [filterText]);
  const rows = useMemo(
    () => (filter.ok ? capture.packets.filter(filter.test) : capture.packets),
    [capture, filter],
  );
  useTitle(`Packets · ${capture.title}`);

  // The cursor is the list's selection in Jali.
  const selected = useJaliState((s) => s.selection[node.id]?.ref);
  const cursorN =
    selected?.kind === "packet" && selected.params.capture === capture.id
      ? Number(selected.params.n)
      : undefined;
  const at = cursorN === undefined ? -1 : rows.findIndex((p) => p.n === cursorN);
  const current = cursorN === undefined ? undefined : capture.packets[cursorN - 1];
  // A packet of this capture by number, as the params the packet panes take.
  const of = (n: number) => ({ capture: capture.id, n });
  const moveTo = (n: number) => select(packet(of(n)));

  // Nothing selected on this list yet (a new capture, or no following packet pane): start on the first row.
  const first = rows[0]?.n;
  useEffect(() => {
    if (cursorN === undefined && first !== undefined)
      select(packet({ capture: capture.id, n: first }));
  }, [cursorN, first, capture.id, select]);

  // A filter that hides the selected packet says so, once, as it changes: the detail keeps the packet, with Jali's
  // "not in the current results" note. The whole capture is loaded, so "not in results" is known, not guessed.
  const hidden = cursorN !== undefined && at < 0;
  const reported = useRef(hidden);
  useEffect(() => {
    if (reported.current === hidden || cursorN === undefined) return;
    reported.current = hidden;
    select(packet({ capture: capture.id, n: cursorN }), hidden ? { inResults: false } : undefined);
  }, [hidden, cursorN, capture.id, select]);

  const openKind = (ref: ObjectRef) => openFollower(jali, node.id, ref);
  const nextWhere = (test: (p: Packet) => boolean) => {
    const from = cursorN ?? 0;
    const next = rows.find((p) => p.n > from && test(p)) ?? rows.find(test);
    if (next) moveTo(next.n);
  };
  const noPacket = current ? false : "No packet selected";

  useCommands([
    {
      id: "open-packet",
      title: current ? `Open packet ${current.n}'s dissection beside` : "Open dissection beside",
      keys: keyHint("Enter"),
      disabled: noPacket,
      run: () => current && openKind(packet(of(current.n))),
    },
    {
      id: "open-bytes",
      title: "Open bytes beside",
      disabled: noPacket,
      run: () => current && openKind(bytes(of(current.n))),
    },
    {
      id: "open-layers",
      title: "Open layers beside",
      disabled: noPacket,
      run: () => current && openKind(layers(of(current.n))),
    },
    {
      id: "open-ladder",
      title: "Open ladder diagram beside",
      run: () => openKind(ladder({ capture: capture.id })),
    },
    {
      id: "compare",
      title: "Compare TLS 1.3 over TCP with HTTP/3 over QUIC beside",
      run: () => openBeside(compare(DEFAULT_COMPARISON)),
    },
    {
      id: "next-retransmission",
      title: "Next retransmission",
      disabled: rows.some(isRetransmission) ? false : "No retransmissions in these packets",
      run: () => nextWhere(isRetransmission),
    },
    {
      id: "next-flagged",
      title: "Next TCP analysis flag",
      disabled: rows.some(isFlagged) ? false : "No TCP analysis flags in these packets",
      run: () => nextWhere(isFlagged),
    },
    { id: "open-file", title: "Open a capture file…", run: pickFile },
    {
      id: "clear-filter",
      title: "Clear the display filter",
      disabled: filterText ? false : "No filter set",
      run: () => setFilterText(""),
    },
  ]);

  const list = useVirtualRows(rows.length, at, ROWS);

  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at, rows.length, { rows: true, page: list.page });
    const row = to === null ? undefined : rows[to];
    if (row) moveTo(row.n);
    else if (!bare(e)) return;
    else if (e.key === "Enter" && current) openKind(packet(of(current.n)));
    else if (e.key === " " && current) peek(packet(of(current.n)));
    else return;
    e.preventDefault();
  };

  const shown = rows.slice(list.start, list.end);
  // The cursor's row is always drawn, so the list's active descendant exists even mid-scroll.
  const cursorRow = rows[at];
  if (cursorRow && (at < list.start || at >= list.end)) shown.push(cursorRow);
  const optionId = (n: number) => `${node.id}-pk-${n}`;
  const options = [
    ...CAPTURES.map((c) => ({ value: c.id, label: c.title, code: "GEN" })),
    ...(capture.madeUp
      ? []
      : [{ value: capture.id, label: capture.fileName ?? "Your file", code: "FILE" }]),
  ];
  const count = (n: number) => n.toLocaleString("en");

  return (
    <>
      <div className="pk-toolbar">
        <Select
          label="Capture"
          options={options}
          value={capture.id}
          onValueChange={(v) => v && v !== capture.id && openHere(packets({ capture: v }))}
        />
        <TextField
          label="Display filter"
          value={filterText}
          onValueChange={setFilterText}
          placeholder="tcp, port 443, ip.addr==…"
          clearable
          error={filter.ok ? undefined : filter.error}
          className="pk-filter"
        />
      </div>
      <div className="pk-about">
        <Provenance capture={capture} />
        <span className="pk-count" aria-live="polite">
          {rows.length === capture.packets.length
            ? `${count(capture.packets.length)} packets · ${capture.format}`
            : `${count(rows.length)} of ${count(capture.packets.length)} packets`}
        </span>
        <OpenButton onOpened={(next) => openHere(packets({ capture: next }))} />
        {fileError ? (
          <p className="pk-error" role="alert">
            {fileError}
          </p>
        ) : null}
        {capture.warnings.map((w) => (
          <p key={w} className="pk-warning">
            {w}
          </p>
        ))}
      </div>
      <div className="pk-head" data-narrow={list.narrow ? "" : undefined} aria-hidden>
        <span className="pk-c-no">No.</span>
        {list.narrow ? (
          <>
            <span className="pk-c-proto">Protocol</span>
            <span>Source → destination</span>
          </>
        ) : (
          <>
            <span className="pk-c-time">Time</span>
            <span className="pk-c-src">Source</span>
            <span className="pk-c-dst">Destination</span>
            <span className="pk-c-proto">Protocol</span>
            <span className="pk-c-len" title="Length on the wire, bytes">
              Len
            </span>
            <span className="pk-c-info">Info</span>
          </>
        )}
      </div>
      <div
        ref={list.ref}
        className="pk-rows"
        role="listbox"
        aria-label={`Packets in ${capture.title}`}
        tabIndex={0}
        aria-activedescendant={cursorRow ? optionId(cursorRow.n) : undefined}
        title="J and K move, ↵ dissects, Space peeks"
        onKeyDown={onKeyDown}
        data-narrow={list.narrow ? "" : undefined}
      >
        {rows.length === 0 ? (
          <Empty title="No packet matches the filter">
            <code>{filterText}</code> leaves nothing out of {capture.packets.length}. Clear it, or
            try one of the examples under Filter syntax.
          </Empty>
        ) : (
          <div className="pk-space" style={{ height: rows.length * list.rowHeight }}>
            {shown.map((p) => {
              const index = rows.indexOf(p);
              return (
                <PacketRow
                  key={p.n}
                  p={p}
                  id={optionId(p.n)}
                  narrow={list.narrow}
                  selected={p.n === cursorN}
                  active={p.n === cursorN && focused}
                  index={index}
                  setSize={rows.length}
                  top={index * list.rowHeight}
                  onClick={() => (p.n === cursorN ? openKind(packet(of(p.n))) : moveTo(p.n))}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className="pk-foot">
        {capture.packets.some(isFlagged) ? (
          <p className="pk-legend">
            <span className="pk-flag" aria-hidden>
              !
            </span>
            TCP analysis flag: a retransmission, duplicate ACK or window change
          </p>
        ) : null}
      </div>
      <ListHelp summary={capture.summary} />
    </>
  );
}

/** One packet's row: on one line when wide, folded into two (addresses beside the protocol) when narrow. */
function PacketRow({
  p,
  id,
  narrow,
  selected,
  active,
  index,
  setSize,
  top,
  onClick,
}: {
  p: Packet;
  id: string;
  narrow: boolean;
  selected: boolean;
  active: boolean;
  index: number;
  setSize: number;
  top: number;
  onClick: () => void;
}) {
  const flagged = isFlagged(p);
  const proto = (
    <span className="pk-c-proto" data-layer={topLayer(p)}>
      {p.protocol}
    </span>
  );
  const info = (
    <span className="pk-c-info">
      {flagged ? (
        <span className="pk-flag" aria-hidden>
          !
        </span>
      ) : null}
      {p.info}
    </span>
  );
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-setsize={setSize}
      aria-posinset={index + 1}
      data-active={active ? "" : undefined}
      data-flagged={flagged ? "" : undefined}
      className="pk-row"
      style={{ transform: `translateY(${top}px)` }}
      onClick={onClick}
    >
      <span className="pk-c-no">{p.n}</span>
      {/* Narrow, the time gives way to the addresses: the order of the rows already says when. */}
      {narrow ? null : <span className="pk-c-time">{p.rel.toFixed(6)}</span>}
      {narrow ? (
        <>
          {proto}
          <span className="pk-c-addr">
            {p.src} → {p.dst}
          </span>
          {info}
        </>
      ) : (
        <>
          <span className="pk-c-src">{p.src}</span>
          <span className="pk-c-dst">{p.dst}</span>
          {proto}
          <span className="pk-c-len">{p.wireLength}</span>
          {info}
        </>
      )}
    </div>
  );
}

const FILTER_EXAMPLES: [string, string][] = [
  ["tcp", "a protocol: eth arp ip ipv6 icmp icmpv6 udp tcp dns mdns dhcp http tls quic"],
  ["ip.addr==192.168.1.1", "either address; also ip.src, ip.dst"],
  ["port 443", "either port, TCP or UDP; also tcp.port==80, udp.port==53"],
  ["tcp.stream==0", "one TCP connection; also udp.stream"],
  [
    "tcp.analysis.flags",
    "any TCP analysis flag; also tcp.analysis.retransmission, .duplicate_ack, .window_update, .zero_window, .lost_segment",
  ],
  ["dns || dhcp", "or; && for and, ! for not, and parentheses"],
];

/** Under the list: what this capture shows, the filter syntax, and how to record a capture of your own. */
function ListHelp({ summary }: { summary: string }) {
  return (
    <Collapsible label={summary ? "About this capture" : "Filters and recording"} summary="Help">
      <div className="pk-help">
        {summary ? <p className="pk-summary">{summary}</p> : null}
        <h3 className="pk-section">Display filter</h3>
        <dl className="pk-syntax">
          {FILTER_EXAMPLES.map(([code, what]) => (
            <div key={code}>
              <dt>
                <code>{code}</code>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <h3 className="pk-section">Record your own</h3>
        <RecordSteps />
      </div>
    </Collapsible>
  );
}

export const packets = definePane("packets", {
  params: packetsParams,
  title: ({ capture }) => `Packets · ${captureTitle(capture)}`,
  icon: Rows3,
  width: { min: 320, comfortable: 720 },
  height: { min: 280 },
  holdWhileResizing: true,
  // It reports select(packet(...)): with nothing selected, it starts on what its following packet pane shows.
  selects: "packet",
  Component: PacketList,
});
