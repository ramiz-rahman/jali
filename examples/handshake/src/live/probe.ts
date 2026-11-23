/**
 * Probing a domain: DNS from two resolvers, its registration, the networks announcing its addresses, and its
 * certificates in public logs. Each section is its own request with its own loading, failure, cancellation and
 * retry, so one source failing or rate-limiting never blocks the others. A handful of recent domains are kept.
 */
import { createStore, IDLE, LOADING, type Remote } from "#src/store.ts";
import { failure, HttpError, request } from "./http";
import {
  addresses,
  DNS_TYPES,
  parseCertificates,
  parseDns,
  parseNetwork,
  parseRdap,
  type Certificate,
  type DnsResult,
  type DnsType,
  type Network,
  type Registration,
} from "./probe-model";

export const PROVIDERS = ["Cloudflare", "Google"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const DNS_TYPE_LIST = Object.keys(DNS_TYPES) as DnsType[];

const RESOLVER: Record<Provider, string> = {
  Cloudflare: "https://cloudflare-dns.com/dns-query",
  Google: "https://dns.google/resolve",
};

/** How many domains are kept; older ones are dropped and their requests stopped. */
const KEEP = 8;

export type ProbeSession = {
  domain: string;
  startedAt?: string;
  dns: Record<DnsType, Record<Provider, Remote<DnsResult>>>;
  rdap: Remote<Registration>;
  certificates: Remote<Certificate[]>;
  networks: Record<string, Remote<Network>>;
};

function blank(domain: string): ProbeSession {
  return {
    domain,
    dns: Object.fromEntries(
      DNS_TYPE_LIST.map((type) => [type, { Cloudflare: IDLE, Google: IDLE }]),
    ) as ProbeSession["dns"],
    rdap: IDLE,
    certificates: IDLE,
    networks: {},
  };
}

export const probeStore = createStore<Readonly<Record<string, ProbeSession>>>({});

/** Blank probes, one per domain, so reading a domain not yet probed gives the same object every time. */
const blanks = new Map<string, ProbeSession>();

/** A domain's probe, blank until it is started. */
export function probeOf(all: Readonly<Record<string, ProbeSession>>, domain: string): ProbeSession {
  const known = all[domain];
  if (known) return known;
  let empty = blanks.get(domain);
  if (!empty) {
    empty = blank(domain);
    blanks.set(domain, empty);
  }
  return empty;
}

/** Every answer either resolver has given, so far. */
export const answersOf = (p: ProbeSession): DnsResult[] =>
  DNS_TYPE_LIST.flatMap((type) =>
    PROVIDERS.flatMap((provider) => {
      const r = p.dns[type][provider];
      return r.status === "ready" ? [r.data] : [];
    }),
  );

/** Whether any section of a probe is still waiting on its source. */
export function isPending(p: ProbeSession): boolean {
  const sections: Remote<unknown>[] = [
    ...DNS_TYPE_LIST.flatMap((type) => PROVIDERS.map((provider) => p.dns[type][provider])),
    p.rdap,
    p.certificates,
    ...Object.values(p.networks),
  ];
  return sections.some((r) => r.status === "loading");
}

const update = (domain: string, change: (p: ProbeSession) => ProbeSession) =>
  probeStore.update((all) => ({ ...all, [domain]: change(probeOf(all, domain)) }));

/** The request in flight for each section of each domain, so a retry or a new probe can stop it. */
const inFlight = new Map<string, Map<string, AbortController>>();

function stop(domain: string, which: (section: string) => boolean = () => true) {
  const sections = inFlight.get(domain);
  for (const [section, c] of sections ?? []) {
    if (!which(section)) continue;
    c.abort();
    sections?.delete(section);
  }
}

const retryAtOf = (r: Remote<unknown> | undefined) =>
  r?.status === "failed" ? r.retryAt : undefined;

async function load<T>(
  domain: string,
  section: string,
  current: Remote<T> | undefined,
  set: (value: Remote<T>) => void,
  work: (signal: AbortSignal) => Promise<T>,
) {
  const retryAt = retryAtOf(current);
  if (retryAt && retryAt > Date.now()) return;
  const sections = inFlight.get(domain) ?? new Map<string, AbortController>();
  inFlight.set(domain, sections);
  sections.get(section)?.abort();
  const own = new AbortController();
  sections.set(section, own);
  set(LOADING);
  try {
    const data = await work(own.signal);
    if (!own.signal.aborted) set({ status: "ready", data });
  } catch (error) {
    if (own.signal.aborted) return;
    const limited = error instanceof HttpError && error.status === 429;
    const next = error instanceof HttpError ? error.retryAt : undefined;
    set({
      status: "failed",
      error: limited
        ? "The source rate-limited this lookup. Wait for the retry time; other sections are independent."
        : failure(error),
      retryAt: limited ? (next ?? Date.now() + 60_000) : next,
    });
  } finally {
    if (sections.get(section) === own) sections.delete(section);
  }
}

const text = async (url: string, signal: AbortSignal, init?: RequestInit) =>
  (await request(url, signal, init)).text;

export function probeNetwork(domain: string, ip: string) {
  return load(
    domain,
    `ip/${ip}`,
    probeOf(probeStore.get(), domain).networks[ip],
    (value: Remote<Network>) =>
      update(domain, (p) => ({ ...p, networks: { ...p.networks, [ip]: value } })),
    async (signal) =>
      parseNetwork(
        await text(
          `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(ip)}`,
          signal,
        ),
      ),
  );
}

export function probeDns(domain: string, type: DnsType, provider: Provider) {
  return load(
    domain,
    `dns/${type}/${provider}`,
    probeOf(probeStore.get(), domain).dns[type][provider],
    (value: Remote<DnsResult>) => {
      update(domain, (p) => ({
        ...p,
        dns: { ...p.dns, [type]: { ...p.dns[type], [provider]: value } },
      }));
      // Each new address gets its own lookup of the network announcing it.
      if (value.status === "ready" && (type === "A" || type === "AAAA"))
        for (const ip of addresses([value.data]))
          if (!probeOf(probeStore.get(), domain).networks[ip]) void probeNetwork(domain, ip);
    },
    async (signal) =>
      parseDns(
        await text(
          `${RESOLVER[provider]}?name=${encodeURIComponent(domain)}&type=${DNS_TYPES[type]}&do=1`,
          signal,
          { headers: { accept: "application/dns-json" } },
        ),
      ),
  );
}

export function probeRdap(domain: string) {
  return load(
    domain,
    "rdap",
    probeOf(probeStore.get(), domain).rdap,
    (value: Remote<Registration>) => update(domain, (p) => ({ ...p, rdap: value })),
    async (signal) => {
      // RDAP names registrations, so a hostname may need its registered parent. Only walk on an explicit 404.
      for (let candidate = domain; ; candidate = candidate.slice(candidate.indexOf(".") + 1)) {
        try {
          return parseRdap(
            await text(`https://rdap.org/domain/${encodeURIComponent(candidate)}`, signal),
          );
        } catch (error) {
          const walk =
            error instanceof HttpError && error.status === 404 && candidate.split(".").length > 2;
          if (!walk) throw error;
        }
      }
    },
  );
}

export function probeCertificates(domain: string) {
  return load(
    domain,
    "certificates",
    probeOf(probeStore.get(), domain).certificates,
    (value: Remote<Certificate[]>) => update(domain, (p) => ({ ...p, certificates: value })),
    async (signal) =>
      parseCertificates(
        await text(
          `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names&expand=issuer`,
          signal,
        ),
      ),
  );
}

/** Retry one record type with both resolvers. */
export function probeDnsType(domain: string, type: DnsType) {
  for (const provider of PROVIDERS) void probeDns(domain, type, provider);
}

/** Probe a domain from the start: every section, with the networks found afresh. */
export function startProbe(domain: string) {
  stop(domain, (section) => section.startsWith("ip/"));
  update(domain, (p) => ({ ...p, startedAt: new Date().toISOString(), networks: {} }));
  for (const type of DNS_TYPE_LIST) probeDnsType(domain, type);
  void probeRdap(domain);
  void probeCertificates(domain);
  // Keep only a handful of domains, and stop the work of the ones dropped.
  const others = Object.keys(probeStore.get()).filter((d) => d !== domain);
  const dropped = others.slice(0, Math.max(0, others.length + 1 - KEEP));
  if (!dropped.length) return;
  for (const d of dropped) {
    stop(d);
    inFlight.delete(d);
  }
  probeStore.update((all) =>
    Object.fromEntries(Object.entries(all).filter(([d]) => !dropped.includes(d))),
  );
}
