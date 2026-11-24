/**
 * Where a packet's headers sit in the two models people use: OSI's seven layers beside TCP/IP's four, with this
 * packet's actual headers placed on the rows, their sizes in bytes, and what wraps what. Then the honest part: the
 * protocols that don't fit OSI's boxes (TLS, QUIC, ARP), said plainly for the packet in view.
 */
import type { ReactNode } from "react";
import { definePane, type PaneProps } from "jali-layout/react";
import { Layers as LayersIcon } from "lucide-react";
import { displayLayer, stackOf } from "#src/packets/fields.ts";
import type { Capture, Header, Packet, ProtoId } from "#src/packets/types.ts";
import { followPacket, PacketGate, PacketHead } from "./parts/capture";
import { PaneBody } from "./parts/states";

const layersParams = { capture: String, n: Number };

const OSI = [
  { n: 7, name: "Application", what: "What the program means: a lookup, a request" },
  { n: 6, name: "Presentation", what: "Encoding and encryption" },
  { n: 5, name: "Session", what: "Dialogues kept up over time" },
  { n: 4, name: "Transport", what: "Ports; reliability or not" },
  { n: 3, name: "Network", what: "Addresses across networks; routing" },
  { n: 2, name: "Data link", what: "Frames between neighbours on one link" },
  { n: 1, name: "Physical", what: "Bits as voltage, light or radio" },
] as const;

/** TCP/IP's four layers (RFC 1122), with the OSI rows each spans. */
const TCPIP = [
  { name: "Application", rows: [7, 6, 5], layer: "app" },
  { name: "Transport", rows: [4], layer: "transport" },
  { name: "Internet", rows: [3], layer: "net" },
  { name: "Link", rows: [2, 1], layer: "link" },
] as const;

/** Which OSI row a protocol's header is drawn on; a range where it straddles. */
const OSI_ROW: Partial<Record<ProtoId, [number, number]>> = {
  eth: [2, 2],
  vlan: [2, 2],
  sll: [2, 2],
  loop: [2, 2],
  arp: [2, 3],
  ip: [3, 3],
  ipv6: [3, 3],
  icmp: [3, 3],
  icmpv6: [3, 3],
  udp: [4, 4],
  tcp: [4, 4],
  quic: [4, 6],
  tls: [5, 6],
  dns: [7, 7],
  dhcp: [7, 7],
  http: [7, 7],
};

const CAVEATS: Partial<Record<ProtoId, string>> = {
  tls: "TLS doesn't fit a row. It runs on TCP and under HTTP, and does session and presentation work (a handshake, then encryption): call it between 4 and 7. TCP/IP has no such row; RFC 1122 would put it in Application.",
  quic: "QUIC spans 4 to 6. It is a transport (streams, loss recovery, congestion control), it carries TLS 1.3's handshake inside itself, and it encrypts its own headers. And it runs on UDP, which is a transport too.",
  arp: "ARP sits between 2 and 3: it resolves network-layer addresses, but it is carried straight in Ethernet frames and never crosses a router.",
  icmp: "ICMP rides inside IP like a transport, but it is part of the internet layer: IP's own error and diagnostic channel.",
  icmpv6:
    "ICMPv6 rides inside IPv6 like a transport, but it is part of the internet layer, and Neighbor Discovery makes it do ARP's job too.",
  dhcp: "DHCP is an application on UDP that configures the network layer: a host uses layer 7 to get its layer 3 address.",
};

/** The OSI row a header is drawn on: data takes the row above the header it is in. */
function rowsOf(h: Header, stack: Header[], i: number): [number, number] {
  const known = OSI_ROW[h.proto];
  if (known) return known;
  const below = stack[i - 1];
  const r = below ? rowsOf(below, stack, i - 1)[1] : 1;
  return [Math.min(7, r + 1), 7];
}

/** The headers below the application: what "overhead" means in the byte count. */
const LOWER = new Set<ProtoId>(["eth", "vlan", "sll", "loop", "ip", "ipv6", "udp", "tcp"]);

function LayersView({ params, openHere }: PaneProps<typeof layersParams>) {
  // Nothing in it takes focus, so the scrolling body itself does: the keyboard can scroll it.
  return (
    <PaneBody
      className="pk-layers"
      tabIndex={0}
      role="region"
      aria-label={`Layers of packet ${params.n}`}
    >
      <PacketGate {...params} onOpened={(capture) => openHere(layers({ ...params, capture }))}>
        {(capture, p) => <Models capture={capture} p={p} />}
      </PacketGate>
    </PaneBody>
  );
}

function Models({ capture, p }: { capture: Capture; p: Packet }) {
  const stack = stackOf(p);
  const placed = stack.map((h, i) => ({ h, rows: rowsOf(h, stack, i) }));
  const headerBytes = stack.filter((h) => LOWER.has(h.proto)).reduce((n, h) => n + h.length, 0);
  const payload = Math.max(0, p.data.length - headerBytes);
  const caveats = [...new Set(stack.map((h) => h.proto))].flatMap((proto) =>
    CAVEATS[proto] ? [CAVEATS[proto]] : [],
  );
  const chip = (h: Header, rows: [number, number]) => (
    <span key={h.id} className="pk-layer-chip" data-layer={displayLayer(h)}>
      {h.short}
      {rows[0] !== rows[1] ? ` (${rows[0]}–${rows[1]})` : ""}{" "}
      <span className="pk-chip-size">{h.length} B</span>
    </span>
  );

  return (
    <>
      <PacketHead capture={capture} p={p} detail={p.info} />

      <h3 className="pk-section">What wraps what</h3>
      <div
        className="pk-nest"
        role="img"
        aria-label={`Encapsulation: ${stack.map((h) => h.short).join(" in ")}`}
      >
        {stack.reduceRight<ReactNode>(
          (inner, h) => (
            <div className="pk-nest-box" data-layer={displayLayer(h)} key={h.id}>
              <span className="pk-nest-label">
                <b>{h.short}</b>{" "}
                {LOWER.has(h.proto)
                  ? `${h.length} B header, carrying ${Math.max(0, h.extent - h.length)} B`
                  : `${h.length} B`}
              </span>
              {inner}
            </div>
          ),
          null,
        )}
      </div>
      <div className="pk-bar" aria-hidden>
        {stack.map((h) =>
          h.length > 0 ? (
            <span
              key={h.id}
              data-layer={displayLayer(h)}
              style={{ flexGrow: h.length }}
              title={`${h.short}: ${h.length} B`}
            />
          ) : null,
        )}
      </div>
      <p className="pk-muted">
        Link, internet and transport headers: {headerBytes} B, carrying {payload} B above them
        {p.data.length > 0 ? ` (${Math.round((headerBytes / p.data.length) * 100)}% overhead)` : ""}
        . The first header on the wire is the outermost box.
      </p>

      <h3 className="pk-section">OSI beside TCP/IP</h3>
      <div
        className="pk-models"
        role="table"
        aria-label="This packet's headers on the OSI and TCP/IP models"
      >
        <div className="pk-models-head" role="row">
          <span role="columnheader">OSI, 7 layers</span>
          <span role="columnheader">This packet</span>
          <span role="columnheader">TCP/IP, 4 layers</span>
        </div>
        {OSI.map((row, index) => {
          // A header that straddles rows is drawn once, on its top row, with its range.
          const here = placed.filter(({ rows }) => rows[1] === row.n);
          const tcpip = TCPIP.find((t) => (t.rows as readonly number[])[0] === row.n);
          return (
            <div className="pk-models-row" role="row" key={row.n} data-osi={row.n}>
              <span role="cell" className="pk-osi">
                <b>
                  {row.n} {row.name}
                </b>
                <span className="pk-muted">{row.what}</span>
              </span>
              <span role="cell" className="pk-here">
                {row.n === 1 ? (
                  <span className="pk-muted">
                    Not in the capture: the NIC strips the preamble and FCS; Wi-Fi's 802.11 header
                    is swapped for Ethernet's.
                  </span>
                ) : here.length ? (
                  here.map(({ h, rows }) => chip(h, rows))
                ) : (
                  <span className="pk-muted">—</span>
                )}
              </span>
              {tcpip ? (
                <span
                  role="cell"
                  className="pk-tcpip"
                  data-layer={tcpip.layer}
                  style={{ gridColumn: 3, gridRow: `${index + 2} / span ${tcpip.rows.length}` }}
                >
                  <b>{tcpip.name}</b>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <h3 className="pk-section">Where the models stop fitting</h3>
      <ul className="pk-caveats">
        {caveats.map((c) => (
          <li key={c}>{c}</li>
        ))}
        <li>
          OSI is a teaching model; the internet was built on TCP/IP's four layers (RFC 1122), and
          real stacks blur even those: NICs compute TCP checksums, and QUIC lives in the
          application, not the kernel.
        </li>
      </ul>
    </>
  );
}

export const layers = definePane("layers", {
  params: layersParams,
  title: ({ n }) => `Layers · packet ${n}`,
  icon: LayersIcon,
  width: { min: 320, comfortable: 520, max: 820 },
  height: { min: 240 },
  // A list of packets, or a lesson step, selects packet({ capture, n }): place that packet's headers.
  follow: followPacket,
  Component: LayersView,
});
