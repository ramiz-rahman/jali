/** Strict decoders for public DNS, registry, routing and certificate responses. No network is used here. */
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const strings = (value: unknown): string[] =>
  list(value).filter((item): item is string => typeof item === "string");
const string = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export function normalizeDomain(input: string): string {
  const value = input.trim().replace(/\.$/, "");
  if (!value || /[\s/:@?#\\%]/u.test(value))
    throw new Error("Enter a DNS hostname, without a scheme, path, port or wildcard.");
  const host = new URL(`https://${value}`).hostname.toLowerCase();
  const labels = host.split(".");
  if (
    host.length > 253 ||
    labels.length < 2 ||
    /^\d+(?:\.\d+){3}$/.test(host) ||
    labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new Error("Use a valid domain with at least two labels, such as example.com.");
  return host;
}

export const DNS_TYPES = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  NS: 2,
  MX: 15,
  TXT: 16,
  CAA: 257,
  SOA: 6,
  HTTPS: 65,
} as const;
export type DnsType = keyof typeof DNS_TYPES;
export type DnsRecord = { name: string; type: number; ttl: number; data: string };
export type DnsResult = {
  status: number;
  ad: boolean;
  answers: DnsRecord[];
  authority: DnsRecord[];
};
export function parseDns(text: string): DnsResult {
  const data = object(JSON.parse(text));
  if (typeof data.Status !== "number")
    throw new Error("The resolver returned an unrecognized DNS response.");
  const records = (raw: unknown) =>
    list(raw).flatMap((item): DnsRecord[] => {
      const row = object(item);
      return typeof row.name === "string" &&
        typeof row.type === "number" &&
        typeof row.TTL === "number" &&
        typeof row.data === "string"
        ? [{ name: row.name, type: row.type, ttl: row.TTL, data: row.data }]
        : [];
    });
  return {
    status: data.Status,
    ad: data.AD === true,
    answers: records(data.Answer),
    authority: records(data.Authority),
  };
}

export function dnsStatus(status: number): string {
  return (
    (
      {
        0: "NOERROR",
        1: "FORMERR",
        2: "SERVFAIL",
        3: "NXDOMAIN",
        4: "NOTIMP",
        5: "REFUSED",
      } as Record<number, string>
    )[status] ?? `RCODE ${status}`
  );
}

export function sameDns(a: DnsResult, b: DnsResult): boolean {
  const records = (rows: DnsRecord[]) =>
    rows
      .filter((row) => row.type !== 46)
      .map((row) => [
        row.name.toLowerCase().replace(/\.$/, ""),
        row.type,
        row.ttl,
        row.data.replace(/\.$/, ""),
      ])
      .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
  const key = (result: DnsResult) =>
    JSON.stringify({
      status: result.status,
      ad: result.ad,
      answers: records(result.answers),
      authority: records(result.authority),
    });
  return key(a) === key(b);
}

export type HttpsRecord = {
  alpn: string[];
  ipv4: string[];
  ipv6: string[];
  ech: boolean;
  decoded: boolean;
};
export function parseHttps(raw: string): HttpsRecord {
  const value: HttpsRecord = { alpn: [], ipv4: [], ipv6: [], ech: false, decoded: false };
  if (!/^\\?#\s/.test(raw)) {
    value.decoded = /^\d+\s+\S+/.test(raw);
    for (const match of raw.matchAll(
      /(?:^|\s)(alpn|ipv4hint|ipv6hint|ech|echconfig)=(?:"([^"]*)"|(\S+))/g,
    )) {
      const data = (match[2] ?? match[3] ?? "").split(",").filter(Boolean);
      if (match[1] === "alpn") value.alpn = data;
      else if (match[1] === "ipv4hint") value.ipv4 = data;
      else if (match[1] === "ipv6hint") value.ipv6 = data;
      else value.ech = true;
    }
    return value;
  }
  // RFC 3597 generic RDATA, used by some JSON resolvers for SVCB/HTTPS.
  const parts = /^\\?#\s+(\d+)\s+([a-f\d\s]+)$/i.exec(raw);
  const hex = parts?.[2]?.replace(/\s/g, "") ?? "";
  if (!parts || hex.length % 2 || hex.length / 2 !== Number(parts[1])) return value;
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));
  let at = 2;
  while (at < bytes.length && bytes[at] !== 0) {
    const length = bytes[at] ?? 0;
    if (length > 63) return value;
    at += length + 1;
  }
  if (at >= bytes.length) return value;
  at++;
  while (at + 4 <= bytes.length) {
    const key = (bytes[at] ?? 0) * 256 + (bytes[at + 1] ?? 0);
    const size = (bytes[at + 2] ?? 0) * 256 + (bytes[at + 3] ?? 0);
    at += 4;
    if (at + size > bytes.length) return { ...value, decoded: false };
    const data = bytes.slice(at, at + size);
    if (key === 1) {
      let i = 0;
      while (i < size) {
        const n = data[i] ?? 0;
        if (!n || i + n + 1 > size) return value;
        value.alpn.push(new TextDecoder().decode(data.slice(i + 1, i + 1 + n)));
        i += n + 1;
      }
    }
    if (key === 4 && size % 4 === 0)
      for (let i = 0; i < size; i += 4) value.ipv4.push(data.slice(i, i + 4).join("."));
    if (key === 6 && size % 16 === 0)
      for (let i = 0; i < size; i += 16)
        value.ipv6.push(
          Array.from({ length: 8 }, (_, group) =>
            ((data[i + group * 2] ?? 0) * 256 + (data[i + group * 2 + 1] ?? 0)).toString(16),
          ).join(":"),
        );
    if (key === 5) value.ech = true;
    at += size;
  }
  value.decoded = at === bytes.length;
  return value;
}

/** Whether an HTTPS record's ALPN offers HTTP/3 (h3, or a draft h3-NN). */
export const advertisesH3 = (record: Pick<HttpsRecord, "alpn">) =>
  record.alpn.some((alpn) => alpn === "h3" || alpn.startsWith("h3-"));

export function addresses(results: DnsResult[]): string[] {
  return [
    ...new Set(
      results.flatMap((result) =>
        result.answers.filter((row) => row.type === 1 || row.type === 28).map((row) => row.data),
      ),
    ),
  ];
}

export type Registration = {
  domain: string;
  registrar?: string;
  created?: string;
  expires?: string;
  status: string[];
  nameservers: string[];
};
export function parseRdap(text: string): Registration {
  const data = object(JSON.parse(text));
  if (data.objectClassName !== "domain")
    throw new Error("The registry did not return a domain registration.");
  const registrar = list(data.entities)
    .map(object)
    .find((entity) => strings(entity.roles).includes("registrar"));
  const card = list(list(registrar?.vcardArray)[1]);
  const fn = card.map(list).find((field) => field[0] === "fn");
  const event = (action: string) =>
    string(
      list(data.events)
        .map(object)
        .find((item) => item.eventAction === action)?.eventDate,
    );
  return {
    domain: string(data.unicodeName) ?? string(data.ldhName) ?? "Unreported",
    registrar: string(fn?.[3]) ?? string(registrar?.handle),
    created: event("registration"),
    expires: event("expiration"),
    status: strings(data.status),
    nameservers: list(data.nameservers)
      .map(object)
      .flatMap((ns) => (string(ns.ldhName) ? [String(ns.ldhName)] : [])),
  };
}

export type Network = {
  prefix: string;
  announced: boolean;
  asns: { asn: number; holder: string }[];
  time?: string;
};
export function parseNetwork(text: string): Network {
  const root = object(JSON.parse(text));
  const data = object(root.data);
  if (typeof data.resource !== "string" || typeof data.announced !== "boolean")
    throw new Error("RIPEstat returned an unrecognized prefix overview.");
  return {
    prefix: data.resource,
    announced: data.announced,
    time: string(data.query_time),
    asns: list(data.asns)
      .map(object)
      .flatMap((asn) =>
        typeof asn.asn === "number"
          ? [{ asn: asn.asn, holder: string(asn.holder) ?? "Holder not reported" }]
          : [],
      ),
  };
}

export type Certificate = {
  id: string;
  issuer: string;
  before: string;
  after: string;
  names: string[];
  revoked: boolean | undefined;
};
/** Where now falls in a certificate's validity dates. */
export type CertWindow = "unreadable" | "not-yet" | "expired" | "valid";

export const CERT_WINDOW_LABEL: Record<CertWindow, string> = {
  unreadable: "Dates not understood",
  "not-yet": "Not yet valid",
  expired: "Expired",
  valid: "Within date window",
};

export function certificateWindow(
  cert: Pick<Certificate, "before" | "after">,
  now = Date.now(),
): CertWindow {
  const before = Date.parse(cert.before);
  const after = Date.parse(cert.after);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return "unreadable";
  if (now < before) return "not-yet";
  if (now > after) return "expired";
  return "valid";
}
export function parseCertificates(text: string): Certificate[] {
  const data: unknown = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Cert Spotter did not return an issuance list.");
  return data.map(object).flatMap((cert) =>
    typeof cert.id === "string" &&
    typeof cert.not_before === "string" &&
    typeof cert.not_after === "string"
      ? [
          {
            id: cert.id,
            issuer:
              string(object(cert.issuer).name) ??
              string(object(cert.issuer).friendly_name) ??
              "Issuer not reported",
            before: cert.not_before,
            after: cert.not_after,
            names: strings(cert.dns_names),
            revoked: typeof cert.revoked === "boolean" ? cert.revoked : undefined,
          },
        ]
      : [],
  );
}

export function subdomains(certs: readonly Certificate[], domain: string): string[] {
  return [
    ...new Set(
      certs.flatMap((cert) =>
        cert.names
          .map((name) => name.toLowerCase().replace(/\.$/, ""))
          .filter((name) => name.endsWith(`.${domain}`)),
      ),
    ),
  ].sort();
}
