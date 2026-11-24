/**
 * The person's connection: Cloudflare's trace, read on open, then a measurement the person starts, with partial
 * results kept and a truthful HTTP/3 experiment. Each panel is one section below; the run and its rules are in
 * live/connection.ts and live/connection-model.ts.
 */
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { definePane, useActivity, useCommands, type PaneProps } from "jali-layout/react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { DataTable } from "#src/vendor/cyberspec/components/ui/data-table.tsx";
import { Feed } from "#src/vendor/cyberspec/components/ui/feed.tsx";
import { HexStat, HexStatGroup } from "#src/vendor/cyberspec/components/ui/hex-stat.tsx";
import { Meter } from "#src/vendor/cyberspec/components/ui/meter.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { Readout } from "#src/vendor/cyberspec/components/ui/readout.tsx";
import { SignalGraph } from "#src/vendor/cyberspec/components/ui/signal-graph.tsx";
import { Terminal } from "#src/vendor/cyberspec/components/ui/terminal.tsx";
import { Tooltip } from "#src/vendor/cyberspec/components/ui/tooltip.tsx";
import {
  cancelConnection,
  connectionStore,
  loadTrace,
  phaseOf,
  runConnection,
  type ConnectionSession,
  type TransferStep,
} from "#src/live/connection.ts";
import {
  bufferbloat,
  bufferGrade,
  ENOUGH,
  H3_TEXT,
  keyExchange,
  latencyStats,
  onH3,
  RUN,
  type Loaded,
  type TcpStats,
} from "#src/live/connection-model.ts";
import { RemoteState } from "./parts/remote";
import { Empty, Failed, Live, Loading, PaneBody } from "./parts/states";
import { useStore } from "./parts/use-store";

const ms = (value: number | undefined) =>
  value === undefined ? "Not exposed" : `${value.toFixed(2)} ms`;
const MB = (bytes: number) => `${bytes / 1_000_000} MB`;
const run = () => void runConnection();

function ConnectionPane({ paused }: PaneProps) {
  const session = useStore(connectionStore);
  const running = session.status === "running";
  useActivity(running ? "working" : session.errors.length ? "error" : "idle");
  useEffect(() => {
    if (!paused && session.trace.status === "idle") void loadTrace();
  }, [paused, session.trace.status]);
  useCommands([
    {
      id: "measure.run",
      title: "Run connection measurement",
      disabled: running ? "A measurement is already running" : false,
      run,
    },
    {
      id: "measure.cancel",
      title: "Cancel connection measurement",
      disabled: running ? false : "No measurement running",
      run: cancelConnection,
    },
  ]);
  const bloat = bufferbloat(session.idle, session.downloadLatency, session.uploadLatency);
  return (
    <PaneBody className="hs-measure hs-connection">
      <header className="hs-measure-head">
        <div>
          <h2>Your connection</h2>
          <p>
            One browser, one path to Cloudflare. Conditions here are a sample, not your ISP’s line
            rate.
          </p>
        </div>
        <Live>Live · Cloudflare</Live>
      </header>
      <RunPanel session={session} idle={bloat.idle} />
      {/* The results appear once there is something to show: before a run they would be seven empty panels. */}
      {session.status === "idle" ? null : (
        <>
          <LatencyPanel session={session} idle={bloat.idle} />
          <BufferbloatPanel down={bloat.down} up={bloat.up} worst={bloat.worst} />
          <TransfersPanel steps={session.steps} />
          <ServerPanel tcp={session.tcp} />
          <Http3Panel session={session} />
        </>
      )}
      <TracePanel session={session} />
      {session.log.length ? (
        <Terminal label="Measurement log" lines={session.log} busy={running} height="18rem" />
      ) : null}
    </PaneBody>
  );
}

function TracePanel({ session }: { session: ConnectionSession }) {
  return (
    <Panel
      title="Connection facts"
      actions={
        <Button
          size="sm"
          onClick={() => void loadTrace()}
          disabled={session.trace.status === "loading"}
        >
          Refresh trace
        </Button>
      }
    >
      <RemoteState label="Cloudflare trace" value={session.trace} retry={() => void loadTrace()}>
        {(trace) => (
          <>
            <dl className="hs-facts">
              {[
                ["Public IP", trace.ip],
                ["Cloudflare colo", trace.colo],
                ["Country (IP geolocation)", trace.loc],
                ["HTTP to speed.cloudflare.com", trace.http],
                ["TLS", trace.tls],
                ["Key exchange", keyExchange(trace.kex)],
                ["WARP", trace.warp],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? "Not reported"}</dd>
                </div>
              ))}
            </dl>
            <p className="hs-note">
              Trace reports the address Cloudflare sees; VPNs and proxies change it. Country is
              inferred from that address. WARP is Cloudflare’s tunnel status. The speed origin may
              use HTTP/1.1 while other origins use HTTP/3.
            </p>
          </>
        )}
      </RemoteState>
    </Panel>
  );
}

/** Most data a run can move: every size, both directions. */
const MOST = RUN.sizes.reduce((n, s) => n + s, 0);

type IdleStats = ReturnType<typeof latencyStats>;

function RunPanel({ session, idle }: { session: ConnectionSession; idle: IdleStats }) {
  const running = session.status === "running";
  const phase = phaseOf(session);
  const last = (direction: TransferStep["direction"]) =>
    session.steps.filter((s) => s.direction === direction).at(-1);
  const down = last("download");
  const up = last("upload");
  return (
    <Panel
      title="Measure the path"
      actions={
        <Badge tone={running ? "flag" : "mute"} status live={running}>
          {phase}
        </Badge>
      }
    >
      {/* The answer first: once there are figures, they lead the panel. */}
      {idle || down || up ? (
        <div className="hs-readouts">
          {idle ? (
            <Readout label="Idle median" value={idle.median} precision={1} unit="ms" />
          ) : null}
          {down ? <Readout label="Download" value={down.rate} precision={2} unit="Mbps" /> : null}
          {up ? <Readout label="Upload" value={up.rate} precision={2} unit="Mbps" /> : null}
        </div>
      ) : null}
      {running ? <Loading label={phase} /> : null}
      {session.status === "cancelled" ? (
        <Alert title="Cancelled" tone="info">
          Partial samples are retained. Run again starts a new measurement.
        </Alert>
      ) : null}
      {session.errors.length ? (
        <Failed title="Some stages were unavailable" retry={run}>
          {session.errors.join(" · ")}
        </Failed>
      ) : null}
      <div className="hs-actions">
        <Tooltip
          content={`${RUN.idleSamples} idle samples, progressive transfers, loaded latency, then an HTTP/3 check`}
        >
          <Button tone="primary" size="lg" disabled={running} onClick={run}>
            {session.status === "idle" ? "Run" : "Run again"}
          </Button>
        </Tooltip>
        {running ? <Button onClick={cancelConnection}>Cancel</Button> : null}
      </div>
      {/* What a run costs, said before it starts; after, a short line. */}
      <p className={session.status === "idle" ? "hs-say" : "hs-note"}>
        Uses up to <strong>{(MOST * 2) / 1_000_000} MB</strong> ({MB(MOST)} down + {MB(MOST)} up):
        transfers of {RUN.sizes.map((s) => (s < 1_000_000 ? `${s / 1000} kB` : MB(s))).join(" → ")}{" "}
        each way, stopping early once a step takes over {RUN.slowStepMs / 1000} s.
      </p>
      {session.status === "idle" ? (
        <p className="hs-note">
          For a fair baseline, pause other downloads and keep this tab in front while it runs.
        </p>
      ) : null}
      {session.finishedAt ? (
        <p className="hs-note">
          Finished {new Date(session.finishedAt).toLocaleTimeString()}. Download and upload are the
          rates of the largest transfer that finished. Kept until you reload; run again after
          changing network.
        </p>
      ) : null}
    </Panel>
  );
}

const SERIES = [
  { key: "idle", name: "Idle", label: "Idle requests" },
  { key: "downloadLatency", name: "Down", label: "Requests during download" },
  { key: "uploadLatency", name: "Up", label: "Requests during upload" },
] as const;

function LatencyPanel({ session, idle }: { session: ConnectionSession; idle: IdleStats }) {
  const [graph, setGraph] = useState<(typeof SERIES)[number]["key"]>("idle");
  const series = SERIES.find((s) => s.key === graph) ?? SERIES[0];
  return (
    <Panel title="Latency under the lens">
      <p className="hs-note">
        Small no-store GETs to speed.cloudflare.com/__down?bytes=0. This is fetch elapsed time,
        including server and browser overhead, not ICMP ping.
      </p>
      <HexStatGroup
        label="Choose latency series; values are completed sample counts"
        columns={3}
        minSize={70}
      >
        {SERIES.map((s) => (
          <HexStat
            key={s.key}
            name={s.name}
            value={session[s.key].length}
            selected={graph === s.key}
            onClick={() => setGraph(s.key)}
          />
        ))}
      </HexStatGroup>
      <SignalGraph
        label={series.label}
        data={session[series.key]}
        unit="ms"
        min={0}
        max={500}
        precision={1}
        live={session.status === "running"}
      />
      <p className="hs-note">
        Fixed 0–500 ms graph; larger values clip visually, but remain in the statistics.
      </p>
      {idle ? (
        <dl className="hs-facts hs-facts-compact">
          <div>
            <dt>Minimum</dt>
            <dd>{ms(idle.min)}</dd>
          </div>
          <div>
            <dt>p90 (nearest rank)</dt>
            <dd>{ms(idle.p90)}</dd>
          </div>
          <div>
            <dt>Jitter (mean |Δ consecutive|)</dt>
            <dd>{ms(idle.jitter)}</dd>
          </div>
        </dl>
      ) : (
        <Empty title="No latency samples yet">Press Run to collect a baseline.</Empty>
      )}
    </Panel>
  );
}

function LoadedFigure({ label, loaded }: { label: string; loaded: Loaded }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {loaded.median === undefined ? "No samples" : ms(loaded.median)} · n={loaded.count}
        {loaded.added === undefined
          ? ""
          : ` · ${loaded.added.toFixed(1)} ms added · grade ${bufferGrade(loaded.added)}`}
      </dd>
    </div>
  );
}

function BufferbloatPanel({ down, up, worst }: { down: Loaded; up: Loaded; worst?: number }) {
  return (
    <Panel title="Loaded latency / bufferbloat">
      <dl className="hs-facts">
        <LoadedFigure label="Download loaded median" loaded={down} />
        <LoadedFigure label="Upload loaded median" loaded={up} />
      </dl>
      {worst !== undefined ? (
        <>
          <Readout
            label={`Worst loaded − idle · grade ${bufferGrade(worst)}`}
            value={worst}
            precision={1}
            unit="ms"
            tone={worst < 30 ? "ok" : "flag"}
          />
          <Meter
            label="Added latency (negative deltas shown as zero on gauge)"
            value={Math.max(0, worst)}
            max={Math.max(250, worst)}
            high={100}
            highLabel="Queueing"
            format={(value) => `${value.toFixed(1)} ms`}
          />
        </>
      ) : (
        <Empty title="Grade needs enough samples">
          At least {ENOUGH.idle} idle and {ENOUGH.loaded} completed requests in each loaded
          direction. Very short transfers may finish before enough loaded pings complete.
        </Empty>
      )}
      <p className="hs-note">
        Lab scale for max(download median, upload median) − idle median: A &lt;5 ms; B 5–&lt;30; C
        30–&lt;60; D 60–&lt;100; E 100–200; F &gt;200. A negative delta is sampling variation.
        Loaded requests run concurrently with each transfer series; this short single-stream test
        may not saturate your link.
      </p>
      <Alert title="If delay rises under load" tone="info">
        Enable Smart Queue Management (SQM) with fq_codel or CAKE on the router and set its shaper
        slightly below the sustained access rate. Compare over Ethernet to separate Wi-Fi contention
        from the WAN queue.
      </Alert>
    </Panel>
  );
}

function TransfersPanel({ steps }: { steps: TransferStep[] }) {
  return (
    <Panel title="Transfer steps">
      {steps.length ? (
        <DataTable<TransferStep>
          caption="Completed transfers"
          code="DECIMAL MB / Mbps"
          rowLabel={(step) => `${step.direction}, ${MB(step.bytes)}`}
          rows={steps}
          columns={[
            {
              id: "direction",
              header: "Direction",
              rowHeader: true,
              cell: (step) => step.direction,
            },
            { id: "size", header: "MB", numeric: true, cell: (step) => step.bytes / 1_000_000 },
            { id: "rate", header: "Mbps", numeric: true, cell: (step) => step.rate.toFixed(2) },
            { id: "elapsed", header: "Elapsed", cell: (step) => ms(step.ms) },
            { id: "ttfb", header: "TTFB", cell: (step) => ms(step.ttfb) },
            { id: "transfer", header: "Response transfer", cell: (step) => ms(step.transfer) },
          ]}
        />
      ) : (
        <Empty title="No transfers yet">Completed sizes appear here, including partial runs.</Empty>
      )}
      <p className="hs-note">
        Download Mbps uses response transfer duration when Resource Timing exposes it, otherwise
        fetch elapsed time. Upload Mbps uses payload / total request time, including server
        response; response transfer is not upload duration. TTFB during POST includes sending the
        body. Timing-Allow-Origin controls visibility; reused connections report zero setup phases.
      </p>
    </Panel>
  );
}

/** What each of Cloudflare's TCP figures is, as the server reports it (`cfL4`). */
const TCP_FIGURES: [keyof TcpStats, string, string, string][] = [
  ["rtt", "Smoothed TCP RTT", "Cloudflare’s estimate of the round trip to this browser.", "ms"],
  ["min_rtt", "Minimum TCP RTT", "Lowest server-observed RTT on this connection.", "ms"],
  ["rtt_var", "RTT variation", "TCP’s smoothed RTT variation, not the fetch jitter above.", "ms"],
  ["cwnd", "Congestion window", "How many TCP segments may be in flight.", "segments"],
  ["retrans", "Retransmissions", "Segments retransmitted on this connection.", "segments"],
  ["lost", "Lost", "Segments the sender has marked lost.", "segments"],
  [
    "delivery_rate",
    "Delivery rate",
    "Server’s recent delivery estimate in bytes per second.",
    "B/s",
  ],
];

function ServerPanel({ tcp }: { tcp?: TcpStats }) {
  return (
    <Panel title="What the server sees">
      {tcp ? (
        <dl className="hs-facts">
          {TCP_FIGURES.map(([key, label, explanation, unit]) => {
            const value = tcp[key];
            return (
              <div key={key}>
                <dt>
                  {label} <code>{key}</code>
                  <span className="hs-note">{explanation}</span>
                </dt>
                <dd>
                  {value === undefined
                    ? "Not reported"
                    : `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <Empty title="TCP statistics not available yet">
          Run the test. Cloudflare’s Server-Timing cfL4 description must be exposed to this browser;
          QUIC paths may omit TCP fields.
        </Empty>
      )}
      <p className="hs-note">
        Latest cfL4 snapshot from the speed endpoint, not lifetime totals for your network. RTT
        values are converted from µs to ms. A ping and a transfer can use different pooled
        connections.
      </p>
    </Panel>
  );
}

function Http3Panel({ session }: { session: ConnectionSession }) {
  const lines = session.log.filter((line) => line.stage === "h3");
  return (
    <Panel title="Can this browser reach HTTP/3?">
      <p>
        Read trace on cloudflare-dns.com → make one DoH query on that origin (advertises Alt-Svc) →
        read trace up to four more times. Each observed protocol is evidence for this origin only.
      </p>
      {lines.length ? (
        <Feed
          label="HTTP/3 experiment steps"
          live={session.stage === "h3"}
          items={lines.map((line) => ({
            id: line.id,
            time: line.time,
            actor: "cloudflare-dns.com",
            text: line.text,
            tone: line.kind === "warn" ? "flag" : "signal",
          }))}
        />
      ) : (
        <Empty title="HTTP/3 check has not run">
          It runs after the transfers when you press Run. An HTTPS DNS record advertising h3 alone
          would not prove that this browser used it.
        </Empty>
      )}
      {session.h3 ? (
        <Alert title="Observed outcome" tone={onH3(session.h3) ? "success" : "info"}>
          {H3_TEXT[session.h3]}
        </Alert>
      ) : null}
    </Panel>
  );
}

export const connection = definePane("connection", {
  title: "Connection",
  icon: Activity,
  width: { min: 300, comfortable: 540 },
  Component: ConnectionPane,
});
