/**
 * A Wi-Fi scan as a channel map: every network placed on the spectrum it occupies, how congested each band is, and
 * which channel to move to with the reasoning in plain sentences. The numbers come from scans/channels.ts, which says
 * what its model leaves out. Opened from the Scans pane; a Wi-Fi pane linked to it follows the scan selected there.
 */
import { useState } from "react";
import { definePane, useCommands, usePaneState, type PaneProps } from "jali/react";
import { Wifi } from "lucide-react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge, type BadgeTone } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import {
  DataTable,
  type DataTableColumn,
} from "#src/vendor/cyberspec/components/ui/data-table.tsx";
import { Meter } from "#src/vendor/cyberspec/components/ui/meter.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { Readout } from "#src/vendor/cyberspec/components/ui/readout.tsx";
import { Tabs } from "#src/vendor/cyberspec/components/ui/tabs.tsx";
import { Empty, PaneBody } from "./parts/states";
import {
  analyseWifi,
  BANDS,
  bandName,
  nameOf,
  signalQuality,
  snrQuality,
  type BandReport,
  type Candidate,
  type Quality,
} from "#src/scans/channels.ts";
import type { LoadedScan } from "#src/scans/store.ts";
import type { Band, WifiNetwork } from "#src/scans/types.ts";
import { ChannelMap } from "./parts/channel-map";
import { ScanGate, ScanHead } from "./parts/scan";

const wifiParams = { scan: String };
const isBand = (v: unknown): Band | undefined => BANDS.find((b) => b === v);

const blockLabel = (c: Candidate): string =>
  c.block.primary === c.block.last
    ? `channel ${c.block.primary}`
    : `channels ${c.block.primary}–${c.block.last}`;

const PERCENT: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "percent",
  maximumFractionDigits: 0,
};

const toneOf = (q: Quality): BadgeTone => q.tone;

function Own({ me }: { me: WifiNetwork }) {
  const signal = me.signalDbm !== undefined ? signalQuality(me.signalDbm) : undefined;
  const snr =
    me.signalDbm !== undefined && me.noiseDbm !== undefined
      ? me.signalDbm - me.noiseDbm
      : undefined;
  const snrQ = snr !== undefined ? snrQuality(snr) : undefined;
  return (
    <Panel
      title="Your connection"
      tone="signal"
      code={me.band ? `${me.band} GHZ · CH ${me.channel}` : undefined}
    >
      <div className="own">
        {me.signalDbm !== undefined && signal ? (
          <div className="own-figure">
            <Readout label="Signal" value={me.signalDbm} unit="dBm" size="sm" />
            <Badge tone={toneOf(signal)}>{signal.label}</Badge>
            <p className="scan-note">{signal.note}</p>
          </div>
        ) : null}
        {me.noiseDbm !== undefined ? (
          <div className="own-figure">
            <Readout label="Noise floor" value={me.noiseDbm} unit="dBm" size="sm" />
            <p className="scan-note">What the radio hears with no one talking. Lower is quieter.</p>
          </div>
        ) : null}
        {snr !== undefined && snrQ ? (
          <div className="own-figure">
            <Readout label="SNR" value={snr} unit="dB" size="sm" />
            <Badge tone={toneOf(snrQ)}>{snrQ.label}</Badge>
            <p className="scan-note">{snrQ.note}</p>
          </div>
        ) : null}
        {me.signalDbm === undefined ? (
          <p className="scan-note">This scan did not report a signal strength for your network.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function Recommendation({ report }: { report: BandReport }) {
  const rec = report.recommendation;
  if (!rec) return null;
  const { best, current } = rec;
  return (
    <Panel
      title="Suggested channel"
      tone="flag"
      code={`${bandName(report.band)} · ${rec.widthMHz} MHZ`}
    >
      <p className="rec-head">
        <span className="rec-big">
          {rec.alreadyBest ? "Stay on" : current ? "Move to" : "Best"} {blockLabel(best)}
        </span>
        <span className="rec-sub">
          {best.block.widthMHz} MHz · congestion {best.congestion}%
          {current && !rec.alreadyBest ? ` (yours now: ${current.congestion}%)` : ""}
        </span>
      </p>
      <ul className="rec-reasons">
        {rec.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      <div className="rec-ranked" role="group" aria-label="Candidates, best first">
        {rec.ranked.map((c) => (
          <Meter
            key={`${c.block.primary}-${c.block.widthMHz}`}
            label={`${blockLabel(c)}${c.block.dfs ? " · DFS" : ""}`}
            value={c.congestion}
            high={65}
            highLabel="Congested"
            format={PERCENT}
          />
        ))}
        {current && !rec.ranked.some((c) => c.block.primary === current.block.primary) ? (
          <Meter
            label={`${blockLabel(current)} · yours`}
            value={current.congestion}
            high={65}
            highLabel="Congested"
            format={PERCENT}
          />
        ) : null}
      </div>
    </Panel>
  );
}

function columns(): DataTableColumn<{ id: string; net: WifiNetwork }>[] {
  return [
    {
      id: "name",
      header: "Network",
      rowHeader: true,
      sort: (r) => nameOf(r.net).toLowerCase(),
      cell: (r) => (
        <span className="net-name">
          <span data-hidden={r.net.ssid ? undefined : ""}>{nameOf(r.net)}</span>
          {r.net.current ? <Badge tone="signal">You</Badge> : null}
        </span>
      ),
    },
    {
      id: "ch",
      header: "Ch",
      numeric: true,
      sort: (r) => r.net.channel ?? 0,
      cell: (r) => r.net.channel ?? "?",
    },
    {
      id: "width",
      header: "Width",
      numeric: true,
      sort: (r) => r.net.widthMHz ?? 0,
      cell: (r) => (
        <span
          title={
            r.net.widthEstimated
              ? "The scan did not report the width: assumed from the band and radio type"
              : undefined
          }
        >
          {r.net.widthEstimated ? "~" : ""}
          {r.net.widthMHz} MHz
        </span>
      ),
    },
    {
      id: "signal",
      header: "Signal",
      numeric: true,
      sort: (r) => r.net.signalDbm ?? -200,
      cell: (r) => {
        const q = r.net.signalDbm !== undefined ? signalQuality(r.net.signalDbm) : undefined;
        return q ? (
          <span className="net-signal">
            {r.net.signalDbm} dBm <Badge tone={toneOf(q)}>{q.label}</Badge>
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      id: "security",
      header: "Security",
      sort: (r) => r.net.security ?? "",
      cell: (r) => r.net.security ?? "—",
    },
    { id: "phy", header: "Radio", cell: (r) => r.net.phy?.replace("802.11", "") ?? "—" },
  ];
}

function BandView({ report }: { report: BandReport }) {
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      report.networks.findIndex((n) => n.current),
    ),
  );
  const nets = report.networks.map((net, index) => ({ net, index }));
  const rows = nets.map((m) => ({ id: String(m.index), net: m.net }));
  const guessed = report.networks.some((n) => n.widthEstimated);
  return (
    <div className="band">
      <Meter
        label={`${bandName(report.band)} congestion, ${report.basis}`}
        value={report.congestion}
        high={65}
        highLabel={report.label}
        format={PERCENT}
      />
      <ChannelMap
        band={report.band}
        nets={nets}
        suggested={report.recommendation?.best.block}
        selected={selected}
        onSelect={setSelected}
      />
      {guessed ? (
        <p className="scan-note">
          This scan does not report channel widths, so networks are drawn at a typical width for
          their band and radio type (marked ~ in the table). Treat overlaps on 5 and 6 GHz as
          indicative.
        </p>
      ) : null}
      <Recommendation report={report} />
      <DataTable
        caption={`${bandName(report.band)} networks`}
        code={`${report.networks.length}`}
        rowLabel={(r) => nameOf(r.net)}
        columns={columns()}
        rows={rows}
        defaultSort={{ column: "signal", direction: "descending" }}
        className="net-table"
      />
    </div>
  );
}

function WifiPane({ params, openBeside, openHere }: PaneProps<typeof wifiParams>) {
  return (
    <PaneBody className="wifi">
      <ScanGate id={params.scan} kind="wifi" openBeside={openBeside} openHere={openHere}>
        {(loaded) => <WifiView loaded={loaded} />}
      </ScanGate>
    </PaneBody>
  );
}

function WifiView({ loaded }: { loaded: LoadedScan<"wifi"> }) {
  const networks = loaded.scan.networks;
  const reports = analyseWifi(networks);
  const mine = networks.find((n) => n.current);
  const redacted = networks.some((n) => n.redacted);
  const unplaced = networks.filter((n) => n.channel === undefined).length;
  const [band, setBand] = usePaneState<Band>("band", mine?.band ?? "5", { parse: isBand });
  const shown = reports.find((r) => r.band === band) ?? reports[0];

  useCommands([
    ...reports.map((r) => ({
      id: `band-${r.band}`,
      title: `Show ${bandName(r.band)}`,
      run: () => setBand(r.band),
    })),
    {
      id: "copy-suggestion",
      title: "Copy suggested channel",
      disabled: shown?.recommendation ? false : "No suggestion for this band",
      run: () => {
        const b = shown?.recommendation?.best;
        if (b)
          void navigator.clipboard?.writeText(
            `${bandName(b.block.band)}: ${blockLabel(b)} at ${b.block.widthMHz} MHz`,
          );
      },
    },
  ]);

  return (
    <>
      <ScanHead loaded={loaded} />
      {redacted ? (
        <Alert tone="info" title="Hidden by macOS — grant Location to see names">
          macOS shows every network name as {"<redacted>"} unless the app that asks has Location
          Services permission. For Terminal: System Settings, Privacy &amp; Security, Location
          Services, Terminal. Channels and signal strength do not depend on it, so the map and the
          suggestion below are complete.
        </Alert>
      ) : null}
      {unplaced ? (
        <p className="scan-note">
          {unplaced} network{unplaced === 1 ? "" : "s"} in this scan did not report a channel and{" "}
          {unplaced === 1 ? "is" : "are"} not drawn.
        </p>
      ) : null}
      {mine ? <Own me={mine} /> : null}
      {reports.length === 0 || !shown ? (
        <Empty title="Nothing to place on a map">
          None of the networks in this scan reported a channel.
        </Empty>
      ) : (
        <Tabs
          label="Band"
          value={shown.band}
          onValueChange={(v) => v && setBand(isBand(v) ?? shown.band)}
          tabs={reports.map((r) => ({
            value: r.band,
            label: bandName(r.band),
            flag: String(r.networks.length),
            content: <BandView key={`${loaded.id}-${r.band}`} report={r} />,
          }))}
        />
      )}
    </>
  );
}

export const wifi = definePane("wifi", {
  params: wifiParams,
  title: "Wi-Fi",
  icon: Wifi,
  width: { min: 320, comfortable: 640 },
  Component: WifiPane,
});
