/** Domain investigation with URL-owned params and independent DNS, registration, routing and CT sections. */
import { useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { definePane, useActivity, useCommands, type PaneProps } from "jali-layout/react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { TextField } from "#src/vendor/cyberspec/components/ui/text-field.tsx";
import {
  answersOf,
  DNS_TYPE_LIST,
  isPending,
  probeCertificates,
  probeDns,
  probeDnsType,
  probeNetwork,
  probeOf,
  probeRdap,
  probeStore,
  PROVIDERS,
  startProbe,
} from "#src/live/probe.ts";
import {
  addresses,
  advertisesH3,
  CERT_WINDOW_LABEL,
  certificateWindow,
  DNS_TYPES,
  dnsStatus,
  normalizeDomain,
  parseHttps,
  sameDns,
  subdomains,
  type DnsResult,
  type DnsType,
} from "#src/live/probe-model.ts";
import type { Remote } from "#src/store.ts";
import { RemoteState } from "./parts/remote";
import { Empty, Live, PaneBody } from "./parts/states";
import { useStore } from "./parts/use-store";

const probeParams = { domain: String };

/** A section's state, with the probe's own word for one that has not run. */
function Section<T>(props: {
  value: Remote<T>;
  label: string;
  retry: () => void;
  children: (data: T) => ReactNode;
}) {
  return (
    <RemoteState
      {...props}
      idle={<Empty title={`${props.label} has not run`}>Press Probe to query this source.</Empty>}
    />
  );
}

function DnsAnswer({ result, type }: { result: DnsResult; type: DnsType }) {
  const answers = result.answers.filter((row) => row.type !== 46);
  return (
    <>
      <div className="hs-actions">
        <Badge tone={result.ad ? "ok" : "mute"}>
          {result.ad ? "DNSSEC validated · AD=1" : "Not validated · AD=0"}
        </Badge>
        <Badge tone={result.status === 0 ? "mute" : "flag"}>{dnsStatus(result.status)}</Badge>
      </div>
      {answers.length ? (
        <ul className="hs-dns-answers">
          {answers.map((answer, index) => (
            <li key={`${answer.name}-${answer.type}-${index}`}>
              <div>
                <code>{answer.name}</code>
                <span className="hs-note">
                  type {answer.type} · TTL {answer.ttl}s
                </span>
              </div>
              <code className="hs-dns-data">{answer.data}</code>
              {answer.type === 65 ? <HttpsSummary raw={answer.data} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {result.status === 0
            ? `No ${type} answer (NODATA).`
            : `${dnsStatus(result.status)}: no answer.`}
        </p>
      )}
      {result.authority.length ? (
        <details>
          <summary>Authority / negative-cache TTL</summary>
          {result.authority.map((answer, index) => (
            <p key={index} className="hs-note">
              <code>
                {answer.name} {answer.ttl}s TYPE{answer.type} {answer.data}
              </code>
            </p>
          ))}
        </details>
      ) : null}
    </>
  );
}
function HttpsSummary({ raw }: { raw: string }) {
  const record = parseHttps(raw);
  if (!record.decoded)
    return <p className="hs-note">HTTPS RDATA could not be decoded; raw record retained above.</p>;
  const h3 = advertisesH3(record);
  return (
    <div className="hs-https-summary">
      <Badge tone={h3 ? "signal" : "mute"}>ALPN: {record.alpn.join(", ") || "not specified"}</Badge>
      <span>
        {h3 ? "HTTP/3 advertised" : "No explicit HTTP/3 ALPN"}
        {record.alpn.includes("h2") ? " · HTTP/2 advertised" : ""}. DNS advertisement is not a
        connection test.
      </span>
      <span>ipv4hint: {record.ipv4.join(", ") || "absent"}</span>
      <span>ipv6hint: {record.ipv6.join(", ") || "absent"}</span>
      <span>ECH config: {record.ech ? "present" : "absent"}</span>
    </div>
  );
}

function ProbeBody({ params, openHere }: PaneProps<typeof probeParams>) {
  const session = useStore(probeStore, (all) => probeOf(all, params.domain));
  const [input, setInput] = useState(params.domain);
  const [error, setError] = useState<string>();
  const pending = isPending(session);
  useActivity(pending ? "loading" : "idle");
  const submit = () => {
    try {
      const domain = normalizeDomain(input);
      setError(undefined);
      // The domain is the pane's param, so it is in the address: a new domain is a new ref.
      if (domain !== params.domain) {
        const result = openHere(probe({ domain }));
        if (!result.ok) {
          setError(
            result.message ?? "The pane could not change domain. Try opening the probe as a pane.",
          );
          return;
        }
      }
      startProbe(domain);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enter a valid domain.");
    }
  };
  useCommands([{ id: "probe.run", title: `Probe ${params.domain}`, run: submit }]);
  const certs = session.certificates.status === "ready" ? session.certificates.data : undefined;
  const resolved = addresses(answersOf(session));
  const networks = Object.entries(session.networks).filter(([ip]) => resolved.includes(ip));
  const discovered = certs ? subdomains(certs, params.domain) : [];
  return (
    <PaneBody className="hs-measure hs-probe">
      <header className="hs-measure-head">
        <div>
          <h2>Probe a domain</h2>
          <p>
            DNS, registration, announcing networks, and certificates in public logs. Queries go to
            the named public sources.
          </p>
        </div>
      </header>
      <form
        className="hs-probe-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          label="Domain"
          name="domain"
          value={input}
          onValueChange={setInput}
          error={error}
          hint="Hostname only. International names are converted to ASCII (punycode) by URL."
          autoComplete="off"
          autoCapitalize="none"
          required
        />
        <Button type="submit" tone="signal">
          {pending ? "Restart probe" : "Probe"}
        </Button>
      </form>
      {!session.startedAt ? (
        <Empty title="Nothing is sent until you press Probe">
          You get the domain’s DNS records from two resolvers side by side, who registered it, the
          networks that announce its addresses, and the certificates logged for it.
        </Empty>
      ) : (
        <>
          <p className="hs-note">
            Requested {new Date(session.startedAt).toLocaleString()}. Responses are
            recursive-resolver snapshots; TTL and geo-routing can make them differ.
          </p>
          <Panel title="DNS / compare resolvers" actions={<Live>Live · Cloudflare + Google</Live>}>
            <p className="hs-note">
              AD=1 means this resolver reports DNSSEC validation. AD=0 alone does not prove the
              domain is unsigned or bogus. HTTPS ALPN advertises protocol support; it does not prove
              this browser connected with HTTP/3. Hints are address hints; ECH presence is not proof
              it was negotiated.
            </p>
            {DNS_TYPE_LIST.map((type) => {
              const { Cloudflare: cf, Google: google } = session.dns[type];
              const agrees =
                cf.status === "ready" && google.status === "ready" && sameDns(cf.data, google.data);
              return (
                <section className="hs-dns-row" key={type} aria-label={`${type} records`}>
                  <header>
                    <h4>
                      {type} <span className="hs-note">TYPE {DNS_TYPES[type]}</span>
                    </h4>
                    {agrees ? <Badge tone="ok">Both agree · including TTL</Badge> : null}
                    <Button
                      size="sm"
                      tone="ghost"
                      disabled={!session.startedAt}
                      onClick={() => probeDnsType(params.domain, type)}
                    >
                      Retry {type}
                    </Button>
                  </header>
                  <div className={agrees ? "hs-dns-single" : "hs-dns-pair"}>
                    {(agrees ? (["Cloudflare"] as const) : PROVIDERS).map((provider) => (
                      <div key={provider}>
                        <h5>{agrees ? "Cloudflare + Google" : provider}</h5>
                        <Section
                          label={`${provider} ${type}`}
                          value={session.dns[type][provider]}
                          retry={() => void probeDns(params.domain, type, provider)}
                        >
                          {(result) => <DnsAnswer result={result} type={type} />}
                        </Section>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </Panel>
          <Panel
            title="Registration / ownership"
            actions={<Live>Live · RDAP registry via rdap.org</Live>}
          >
            <Section label="RDAP" value={session.rdap} retry={() => void probeRdap(params.domain)}>
              {(data) => (
                <dl className="hs-facts">
                  {[
                    ["Registry record for", data.domain],
                    ["Registrar", data.registrar],
                    ["Created", data.created],
                    ["Expires", data.expires],
                    ["Status", data.status.join(" · ")],
                    ["Nameservers", data.nameservers.join(" · ")],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || "Not reported by registry"}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Section>
            <p className="hs-note">
              RDAP describes a registration, not the operator of an individual website. For a
              subdomain, explicit 404 responses trigger a lookup of its parent; the returned domain
              is named above. Registries may redact fields or refuse browser CORS; retry or probe
              the registered parent directly.
            </p>
          </Panel>
          <Panel
            title="Who announces these addresses?"
            actions={<Live>Live · RIPEstat prefix-overview</Live>}
          >
            {networks.length ? (
              <div className="hs-networks">
                {networks.map(([ip, value]) => (
                  <section key={ip} aria-label={`Announcing network for ${ip}`}>
                    <h4>
                      <code>{ip}</code>
                    </h4>
                    <Section
                      label={`Route for ${ip}`}
                      value={value}
                      retry={() => void probeNetwork(params.domain, ip)}
                    >
                      {(data) => (
                        <>
                          <p>
                            <code>{data.prefix}</code> ·{" "}
                            {data.announced ? "announced" : "not announced"}
                          </p>
                          {data.asns.length ? (
                            data.asns.map((asn) => (
                              <p key={asn.asn}>
                                <Badge tone="signal">AS{asn.asn}</Badge> {asn.holder}
                              </p>
                            ))
                          ) : (
                            <p>No origin ASN reported.</p>
                          )}
                          <p className="hs-note">
                            Routing snapshot {data.time ?? "time unreported"}
                          </p>
                        </>
                      )}
                    </Section>
                  </section>
                ))}
              </div>
            ) : (
              <Empty title={pending ? "Waiting for A / AAAA answers" : "No resolved addresses"}>
                Each unique A and AAAA address returned by either resolver gets its own prefix
                lookup. DNS failures do not block RDAP or certificates.
              </Empty>
            )}
            <p className="hs-note">
              The BGP origin ASN announces the prefix. It may be a CDN, hosting provider or anycast
              network; it does not establish website ownership.
            </p>
          </Panel>
          <Panel title="Certificate transparency" actions={<Live>Live · Cert Spotter</Live>}>
            <p className="hs-note">
              First response page from the public issuance API, including subdomains. These are
              logged issuances, not a live TLS handshake or a complete history. A wildcard is a
              pattern, not a discovered host. The service has a low unauthenticated rate limit.
            </p>
            <Section
              label="Cert Spotter"
              value={session.certificates}
              retry={() => void probeCertificates(params.domain)}
            >
              {(data) =>
                data.length ? (
                  <div className="hs-certs">
                    {data.map((cert) => (
                      <article key={cert.id}>
                        <header>
                          <h4>{cert.issuer}</h4>
                          <CertWindowBadge window={certificateWindow(cert)} />
                        </header>
                        <dl className="hs-facts">
                          <div>
                            <dt>Not before</dt>
                            <dd>{cert.before}</dd>
                          </div>
                          <div>
                            <dt>Not after</dt>
                            <dd>{cert.after}</dd>
                          </div>
                          <div>
                            <dt>Revocation reported by source</dt>
                            <dd>
                              {cert.revoked === undefined
                                ? "Unknown"
                                : cert.revoked
                                  ? "Revoked"
                                  : "Not marked revoked"}
                            </dd>
                          </div>
                          <div>
                            <dt>SAN / DNS names</dt>
                            <dd>{cert.names.join(" · ") || "Not expanded by source"}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="No issuances in this response">
                    This does not prove the host has no TLS certificate.
                  </Empty>
                )
              }
            </Section>
            {certs?.length ? (
              <details className="hs-discoveries" open>
                <summary>Subdomain SANs / patterns · {discovered.length} unique</summary>
                {discovered.length ? (
                  <ul>
                    {discovered.map((name) => (
                      <li key={name}>
                        <code>{name}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No subdomain SANs in this response page.</p>
                )}
              </details>
            ) : null}
            {session.certificates.status === "ready" ? (
              <Alert title="CT records are evidence of issuance" tone="info">
                Date validity and a logged SAN do not establish current deployment, trust, or a
                working host. No port scan or TLS certificate inspection is possible through this
                cross-origin browser view.
              </Alert>
            ) : null}
          </Panel>
        </>
      )}
    </PaneBody>
  );
}

function CertWindowBadge({ window }: { window: ReturnType<typeof certificateWindow> }) {
  return <Badge tone={window === "valid" ? "mute" : "flag"}>{CERT_WINDOW_LABEL[window]}</Badge>;
}

export const probe = definePane("probe", {
  params: probeParams,
  title: ({ domain }) => `Probe · ${domain}`,
  icon: Globe,
  width: { min: 300, comfortable: 620 },
  follow: (selected) =>
    selected.kind === "probe" && typeof selected.params.domain === "string"
      ? { domain: selected.params.domain }
      : undefined,
  Component: (props) => <ProbeBody key={props.params.domain} {...props} />,
});
