/**
 * A traceroute as a path: each hop with its address, what kind of address it is (your router, your ISP's carrier
 * NAT, the public internet), its latency as a bar, and notes on what is worth knowing: a jump that is real against
 * one that is a router slow to answer, and what `* * *` does and does not mean. One tab stop on the list; up and
 * down move between hops.
 */
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { definePane, useCommands, type PaneProps } from "jali-layout/react";
import { Route } from "lucide-react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge, type BadgeTone } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { Readout } from "#src/vendor/cyberspec/components/ui/readout.tsx";
import { PaneBody } from "./parts/states";
import { analysePath, fmtMs, type HopRow, type IpClass } from "#src/scans/path-analysis.ts";
import type { LoadedScan } from "#src/scans/store.ts";
import { bare, listMove } from "./parts/list-keys";
import { ScanGate, ScanHead } from "./parts/scan";

const pathParams = { scan: String };

const CLASS_TONE: Record<IpClass, BadgeTone> = {
  private: "mute",
  cgnat: "flag",
  documentation: "mute",
  loopback: "mute",
  "link-local": "mute",
  benchmark: "mute",
  reserved: "mute",
  public: "mute",
};

function Hop({
  r,
  id,
  selected,
  max,
  onPick,
}: {
  r: HopRow;
  id: string;
  selected: boolean;
  max: number;
  onPick: () => void;
}) {
  const hop = r.hop;
  const answered = hop.rtts.filter((x): x is number => x !== null);
  const lo = hop.mtr ? hop.mtr.best : answered.length ? Math.min(...answered) : undefined;
  const hi = hop.mtr ? hop.mtr.worst : answered.length ? Math.max(...answered) : undefined;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      className="hop"
      data-selected={selected ? "" : undefined}
      data-silent={r.silent ? "" : undefined}
      data-jump={r.jump !== undefined ? (r.jumpIsArtefact ? "artefact" : "real") : undefined}
      onClick={onPick}
    >
      <span className="hop-n">{hop.n}</span>
      <span className="hop-who">
        <span className="hop-addr">{hop.name ?? hop.ip ?? "no reply"}</span>
        {hop.name && hop.ip ? <span className="hop-ip">{hop.ip}</span> : null}
        <span className="hop-badges">
          {r.isGateway ? <Badge tone="signal">Your router</Badge> : null}
          {r.ip ? <Badge tone={CLASS_TONE[r.ip.cls]}>{r.ip.label}</Badge> : null}
          {r.isDestination ? <Badge tone="ok">Destination</Badge> : null}
          {r.silent ? <Badge tone="mute">* * *</Badge> : null}
          {r.lost > 0 && !r.silent ? (
            <Badge tone="accent">
              {r.lost}/{r.probes} lost
            </Badge>
          ) : null}
          {r.notes.length ? (
            <Badge tone="mute" title="This hop has notes: select it">
              i
            </Badge>
          ) : null}
        </span>
      </span>
      <span className="hop-bar" aria-hidden>
        {r.silent || r.rtt === undefined ? (
          <span className="hop-none">no reply</span>
        ) : (
          <>
            <span className="hop-fill" style={{ width: pct(r.rtt) }} />
            {lo !== undefined && hi !== undefined && hi > lo ? (
              <span
                className="hop-range"
                style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
              />
            ) : null}
          </>
        )}
      </span>
      <span className="hop-ms">
        {r.rtt !== undefined && !r.silent ? `${fmtMs(r.rtt)} ms` : "—"}
      </span>
    </li>
  );
}

/** A figure in ms, or a dash where the scan did not measure it (a count of 0 would read as a measurement). */
function Figure({
  label,
  value,
  tone = "signal",
}: {
  label: string;
  value: number | undefined;
  tone?: "signal" | "flag";
}) {
  return value === undefined ? (
    <div className="fig-none" role="group" aria-label={`${label}: not measured`}>
      <span className="scan-note">{label}</span>
      <span className="fig-none-value">—</span>
    </div>
  ) : (
    <Readout label={label} value={value} precision={1} unit="ms" size="sm" tone={tone} />
  );
}

function PathView({ loaded }: { loaded: LoadedScan<"path"> }) {
  const summary = useMemo(() => analysePath(loaded.scan), [loaded.scan]);
  const target = loaded.scan.target;
  const uid = useId();
  const [cursor, setCursor] = useState(0);
  const rows = summary.rows;
  const max = Math.max(
    1,
    ...rows.map((r) =>
      r.hop.mtr
        ? r.hop.mtr.worst
        : Math.max(0, ...r.hop.rtts.filter((x): x is number => x !== null)),
    ),
  );
  const sel = rows[Math.min(cursor, rows.length - 1)];
  const optionId = (n: number) => `${uid}-hop-${n}`;
  const move = (to: number) => setCursor(Math.max(0, Math.min(rows.length - 1, to)));
  const interesting = rows.map((r, i) => (r.notes.length ? i : -1)).filter((i) => i >= 0);

  const nextNote = () => move(interesting.find((i) => i > cursor) ?? interesting[0] ?? cursor);

  const onKey = (e: KeyboardEvent) => {
    const to = listMove(e, cursor, rows.length, { rows: true });
    if (to !== null) move(to);
    else if (e.key === "n" && bare(e)) nextNote();
    else return;
    e.preventDefault();
  };

  useCommands([
    {
      id: "next-note",
      title: "Next hop with a note",
      disabled: interesting.length ? false : "No hop has notes",
      run: nextNote,
    },
    {
      id: "copy",
      title: "Copy hops as text",
      run: () =>
        void navigator.clipboard?.writeText(
          rows
            .map(
              (r) =>
                `${r.hop.n}\t${r.hop.ip ?? "*"}\t${r.rtt !== undefined ? fmtMs(r.rtt) + " ms" : ""}`,
            )
            .join("\n"),
        ),
    },
  ]);

  return (
    <>
      <ScanHead loaded={loaded} />
      <div className="path-figures">
        <Readout label="Hops" value={summary.hops} size="sm" />
        <Figure label="To your router" value={summary.gatewayRtt} />
        <Figure
          label={target ? `To ${target}` : "To the last hop"}
          value={summary.endRtt}
          tone={summary.reached ? "signal" : "flag"}
        />
        <Readout
          label="Silent hops"
          value={summary.silentHops}
          size="sm"
          tone={summary.silentHops ? "flag" : undefined}
        />
      </div>
      {!summary.reached ? (
        <Alert tone="warning" title="The trace did not reach its destination">
          The last hop is not the target. Many networks and servers do not answer probes at all, so
          this alone is not a fault: if a browser or ping can reach it, the path works.
        </Alert>
      ) : null}
      {summary.behindCgnat ? (
        <Alert tone="info" title="Your ISP uses carrier-grade NAT">
          A hop in 100.64.0.0/10 is your provider translating many homes onto few public IPv4
          addresses. Outbound traffic is fine; inbound over IPv4 (self-hosting, port forwarding)
          cannot reach you.
        </Alert>
      ) : null}

      <ol
        className="hops"
        role="listbox"
        tabIndex={0}
        aria-label="Hops. Up and down arrows move between them; N jumps to the next hop with a note."
        aria-activedescendant={sel ? optionId(sel.hop.n) : undefined}
        onKeyDown={onKey}
      >
        {rows.map((r, i) => (
          <Hop
            key={r.hop.n}
            r={r}
            id={optionId(r.hop.n)}
            selected={i === cursor}
            max={max}
            onPick={() => setCursor(i)}
          />
        ))}
      </ol>
      <p className="scan-note">
        Bars show the median of the probes; the lighter strip is the fastest to the slowest. A
        router that does not answer shows no bar, and that does not mean your traffic stops there.
      </p>

      {sel ? (
        <Panel
          title={`Hop ${sel.hop.n}${sel.hop.name ? `: ${sel.hop.name}` : sel.hop.ip ? `: ${sel.hop.ip}` : ""}`}
          tone={sel.silent ? "flag" : "signal"}
        >
          <div className="prose">
            {sel.ip ? (
              <p>
                <b>{sel.ip.label}.</b> {sel.ip.note}
              </p>
            ) : null}
            {sel.notes.length ? (
              <ul className="hop-notes">
                {sel.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : (
              <p>Nothing unusual at this hop.</p>
            )}
            {!sel.silent ? (
              <p className="scan-note">
                Probes:{" "}
                {sel.hop.mtr
                  ? `${sel.hop.mtr.sent} sent, ${sel.hop.mtr.lossPct}% lost, best ${fmtMs(sel.hop.mtr.best)}, worst ${fmtMs(sel.hop.mtr.worst)}, σ ${sel.hop.mtr.stdev} ms`
                  : sel.hop.rtts.map((x) => (x === null ? "*" : `${fmtMs(x)} ms`)).join("  ")}
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function PathPane({ params, openBeside, openHere }: PaneProps<typeof pathParams>) {
  return (
    <PaneBody className="path">
      <ScanGate id={params.scan} kind="path" openBeside={openBeside} openHere={openHere}>
        {(loaded) => <PathView loaded={loaded} />}
      </ScanGate>
    </PaneBody>
  );
}

export const path = definePane("path", {
  params: pathParams,
  title: "Path",
  icon: Route,
  width: { min: 320, comfortable: 560 },
  Component: PathPane,
});
