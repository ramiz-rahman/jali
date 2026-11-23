/**
 * The devices a scan found: address, hardware address, vendor from the OUI, and what each entry is (the gateway,
 * a phone using a private address, a multicast group). It says what an ARP table can and cannot see, since the
 * most common mistake is reading it as "every device on the network".
 */
import { useMemo } from "react";
import { definePane, useCommands, usePaneState, type PaneProps } from "jali/react";
import { Network } from "lucide-react";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Collapsible } from "#src/vendor/cyberspec/components/ui/collapsible.tsx";
import {
  DataTable,
  type DataTableColumn,
} from "#src/vendor/cyberspec/components/ui/data-table.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { Readout } from "#src/vendor/cyberspec/components/ui/readout.tsx";
import { SegmentedControl } from "#src/vendor/cyberspec/components/ui/segmented-control.tsx";
import { Empty, PaneBody } from "./parts/states";
import {
  analyseDevices,
  countDevices,
  gatewayFor,
  isHost,
  type DeviceRow,
} from "#src/scans/devices-analysis.ts";
import { RANDOMISED_WHY, tableSize } from "#src/scans/oui.ts";
import type { LoadedScan } from "#src/scans/store.ts";
import { ScanGate, ScanHead, useScans } from "./parts/scan";

const devicesParams = { scan: String };

type Filter = "all" | "hosts" | "private";
const FILTERS: Filter[] = ["all", "hosts", "private"];
const isFilter = (v: unknown): Filter | undefined => FILTERS.find((f) => f === v);

const csv = (rows: DeviceRow[]): string =>
  [
    "ip,mac,name,vendor,private_mac,roles",
    ...rows.map((r) =>
      [
        r.ip,
        r.mac ?? "",
        r.host ?? "",
        r.vendor ?? "",
        r.randomised ? "yes" : "",
        r.roles.join(" "),
      ]
        .map((c) => `"${c.replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

function Notes({ r }: { r: DeviceRow }) {
  return (
    <span className="dev-notes">
      {r.roles.includes("gateway") ? (
        <Badge tone="signal" title="The first hop of a traceroute you loaded: your router">
          Gateway
        </Badge>
      ) : null}
      {r.roles.includes("likely-gateway") ? (
        <Badge
          tone="signal"
          title="A guess: .1 and .254 are where routers usually sit. Load a traceroute to confirm."
        >
          Likely gateway
        </Badge>
      ) : null}
      {r.randomised ? (
        <Badge
          tone="mute"
          title="Locally administered MAC: made up by the device, not assigned by a vendor"
        >
          Private MAC
        </Badge>
      ) : null}
      {r.roles.includes("multicast") ? <Badge tone="mute">Multicast</Badge> : null}
      {r.roles.includes("broadcast") ? <Badge tone="mute">Broadcast</Badge> : null}
      {r.roles.includes("incomplete") ? (
        <Badge
          tone="flag"
          title="ARP asked who has this address and nothing answered: the host is off, asleep or not there"
        >
          No reply
        </Badge>
      ) : null}
      {r.moduleMaker ? (
        <Badge
          tone="mute"
          title="This vendor makes the Wi-Fi module, not the product: the brand on the box is probably someone else"
        >
          Module maker
        </Badge>
      ) : null}
    </span>
  );
}

function columns(withPorts: boolean, withLatency: boolean): DataTableColumn<DeviceRow>[] {
  const cols: DataTableColumn<DeviceRow>[] = [
    {
      id: "ip",
      header: "Address",
      rowHeader: true,
      sort: (r) =>
        r.ip
          .split(".")
          .map((o) => o.padStart(3, "0"))
          .join("."),
      cell: (r) => <span className="mono">{r.ip}</span>,
    },
    { id: "host", header: "Name", sort: (r) => r.host ?? "~", cell: (r) => r.host ?? "—" },
    {
      id: "mac",
      header: "MAC",
      sort: (r) => r.mac ?? "~",
      cell: (r) => <span className="mono">{r.mac ?? "—"}</span>,
    },
    {
      id: "vendor",
      header: "Vendor",
      sort: (r) => r.vendor ?? "~",
      cell: (r) =>
        r.vendor ? (
          <span
            title={
              r.vendorSource === "nmap" ? "From nmap's own table" : "From the IEEE OUI registry"
            }
          >
            {r.vendor}
          </span>
        ) : r.randomised ? (
          <span className="dev-muted">None: private MAC</span>
        ) : r.mac ? (
          <span className="dev-muted">Unknown</span>
        ) : (
          "—"
        ),
    },
    { id: "notes", header: "Notes", cell: (r) => <Notes r={r} /> },
  ];
  if (withLatency)
    cols.push({
      id: "rtt",
      header: "RTT",
      numeric: true,
      sort: (r) => r.device.latencyMs ?? 1e9,
      cell: (r) => (r.device.latencyMs !== undefined ? `${r.device.latencyMs.toFixed(1)} ms` : "—"),
    });
  if (withPorts) {
    cols.push({
      id: "ports",
      header: "Open ports",
      cell: (r) =>
        r.device.ports?.length
          ? r.device.ports
              .map((p) => `${p.port}/${p.protocol}${p.service ? ` ${p.service}` : ""}`)
              .join(", ")
          : "—",
    });
  }
  return cols;
}

function DevicesView({ loaded }: { loaded: LoadedScan<"devices"> }) {
  const all = useScans();
  const [filter, setFilter] = usePaneState<Filter>("filter", "all", { parse: isFilter });
  const gateway = gatewayFor(loaded, all);
  const entries = loaded.scan.devices;
  const rows = useMemo(() => analyseDevices(entries, { gateway }), [entries, gateway]);
  const counts = countDevices(rows);
  const shown = rows.filter((r) =>
    filter === "hosts" ? isHost(r) : filter === "private" ? r.randomised : true,
  );
  const withPorts = entries.some((d) => d.ports?.length);
  const withLatency = entries.some((d) => d.latencyMs !== undefined);
  const size = tableSize();

  useCommands([
    ...FILTERS.map((f) => ({
      id: `filter-${f}`,
      title: `Show ${f === "all" ? "all entries" : f === "hosts" ? "hosts only" : "private MACs only"}`,
      run: () => setFilter(f),
    })),
    {
      id: "copy-csv",
      title: "Copy devices as CSV",
      run: () => void navigator.clipboard?.writeText(csv(shown)),
    },
  ]);

  return (
    <>
      <ScanHead loaded={loaded} />
      <div className="dev-counts">
        <Readout label="Hosts" value={counts.hosts} size="sm" />
        <Readout label="Private MACs" value={counts.randomised} size="sm" />
        <Readout label="Vendors" value={counts.vendors} size="sm" />
        <Readout label="Multicast / broadcast" value={counts.special} size="sm" />
      </div>
      <SegmentedControl<Filter>
        label="Show"
        value={filter}
        onValueChange={(v) => v && setFilter(isFilter(v) ?? "all")}
        options={[
          { value: "all", label: `All ${rows.length}` },
          { value: "hosts", label: `Hosts ${counts.hosts}` },
          { value: "private", label: `Private MACs ${counts.randomised}` },
        ]}
      />
      {shown.length === 0 ? (
        <Empty title="Nothing matches this filter">
          {filter === "private"
            ? "No entry here uses a private MAC address."
            : "This scan has no entries."}
        </Empty>
      ) : (
        <DataTable
          caption="Device list"
          code={`${shown.length} of ${rows.length}`}
          rowLabel={(r) => r.host ?? r.ip}
          columns={columns(withPorts, withLatency)}
          rows={shown}
          defaultSort={{ column: "ip", direction: "ascending" }}
          className="dev-table"
        />
      )}
      {counts.randomised > 0 ? (
        <Panel title="Why some MACs have no vendor" tone="flag">
          <p className="prose">{RANDOMISED_WHY}</p>
        </Panel>
      ) : null}
      <Collapsible label="What this list can and cannot see" summary="read before trusting a count">
        <div className="prose">
          <p>
            <b>ARP is a cache, not a census.</b> <code>arp -a</code> lists the hosts this machine
            has exchanged packets with lately (entries expire within minutes). A device that has
            been quiet, or that never talks to this machine, is not in it. A phone asleep on Wi-Fi
            often is not.
          </p>
          <p>
            <b>A sweep finds more.</b> <code>nmap -sn 192.168.1.0/24</code> sends an ARP request to
            every address in the subnet and records who answers, so it finds hosts you have never
            talked to. Devices that ignore ARP are rare on a LAN, but isolated guest Wi-Fi (client
            isolation) hides everyone from everyone.
          </p>
          <p>
            <b>Same subnet only.</b> ARP does not cross a router: this shows your own subnet, not a
            guest network or a second router behind yours.
          </p>
          <p>
            <b>Vendor means the chip, not always the brand.</b> The first three bytes name who
            registered the block: often the maker of the Wi-Fi module, so a smart plug may show a
            module maker. Lookup uses {size.vendors} vendors ({size.prefixes.toLocaleString()}{" "}
            prefixes) from the IEEE MA-L registry; an address from another vendor shows Unknown.
          </p>
        </div>
      </Collapsible>
    </>
  );
}

function DevicesPane({ params, openBeside, openHere }: PaneProps<typeof devicesParams>) {
  return (
    <PaneBody className="devices">
      <ScanGate id={params.scan} kind="devices" openBeside={openBeside} openHere={openHere}>
        {(loaded) => <DevicesView loaded={loaded} />}
      </ScanGate>
    </PaneBody>
  );
}

export const devices = definePane("devices", {
  params: devicesParams,
  title: "Devices",
  icon: Network,
  width: { min: 320, comfortable: 560 },
  Component: DevicesPane,
});
