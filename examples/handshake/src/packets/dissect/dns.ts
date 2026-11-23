/**
 * DNS (RFC 1035) over UDP, and its multicast cousins mDNS and LLMNR: the header's flags, questions and records,
 * names with compression pointers followed, and the record types a modern lookup returns: A, AAAA, CNAME, NS, MX,
 * TXT, SOA, SRV, EDNS's OPT, and HTTPS/SVCB with their parameters (alpn, ipv4hint, ipv6hint, ech).
 */
import { hex16, ipv4, ipv6, Src } from "../bytes";
import { DNS_RCODES, DNS_TYPES, named, SVC_KEYS } from "../names";
import type { Field } from "../types";
import { Fields, header, top, type Ctx } from "./core";

/** A name at `at`, with compression pointers followed (RFC 1035 §4.1.4); `size` is what it takes up at `at`. */
export function readName(s: Src, at: number): { name: string; size: number } {
  const labels: string[] = [];
  let i = at;
  let size = -1;
  for (let jumps = 0; jumps < 64;) {
    const len = s.u8(i);
    if (len === 0) {
      if (size < 0) size = i + 1 - at;
      return { name: labels.length ? labels.join(".") : "<Root>", size };
    }
    if ((len & 0xc0) === 0xc0) {
      if (size < 0) size = i + 2 - at;
      i = ((len & 0x3f) << 8) | s.u8(i + 1);
      jumps++;
      continue;
    }
    labels.push(
      Array.from(s.bytes(i + 1, len), (c) =>
        c > 0x20 && c < 0x7f ? String.fromCharCode(c) : `\\${c}`,
      ).join(""),
    );
    i += 1 + len;
  }
  throw new RangeError("A DNS name points in a loop");
}

const TYPE_WHY: Record<number, string> = {
  1: "An IPv4 address for the name.",
  28: "An IPv6 address. A dual-stack client asks for A and AAAA together and races the connections (Happy Eyeballs, RFC 8305).",
  5: "An alias: the real name is elsewhere, often a CDN's. The resolver follows it and returns the chain in one answer.",
  65: "HTTPS record (RFC 9460): before connecting, the browser learns which protocols the server speaks and its addresses, so it can go straight to HTTP/3 and skip the TCP attempt. It can also carry the ECH key.",
  64: "SVCB: the general form of HTTPS records, for any service.",
  15: "Where mail for the domain goes, lowest preference first.",
  16: "Free text: domain ownership proofs, SPF and DMARC policies live here.",
  2: "The servers authoritative for the zone.",
};

function rdata(G: Fields, s: Src, type: number, at: number, len: number): string {
  switch (type) {
    case 1:
      return ipv4(s.bytes(at, 4));
    case 28:
      return ipv6(s.bytes(at, 16));
    case 2:
    case 5:
    case 12:
      return readName(s, at).name;
    case 15:
      return `${s.u16(at)} ${readName(s, at + 2).name}`;
    case 16: {
      const parts: string[] = [];
      for (let i = at; i < at + len;) {
        const n = s.u8(i);
        parts.push(`"${new TextDecoder().decode(s.bytes(i + 1, n))}"`);
        i += 1 + n;
      }
      return parts.join(" ");
    }
    case 6: {
      const m = readName(s, at);
      const r = readName(s, at + m.size);
      return `${m.name} ${r.name} serial ${s.u32(at + m.size + r.size)}`;
    }
    case 33:
      return `${s.u16(at)} ${s.u16(at + 2)} ${s.u16(at + 4)} ${readName(s, at + 6).name}`;
    case 64:
    case 65:
      return svcb(G, s, at, len);
    default:
      return `${len} bytes`;
  }
}

/** SVCB and HTTPS: priority, target, then key=value parameters (RFC 9460 §2.2). */
function svcb(G: Fields, s: Src, at: number, len: number): string {
  const priority = s.u16(at);
  const target = readName(s, at + 2);
  const out = [`${priority}`, target.name === "<Root>" ? "." : target.name];
  G.f(
    "priority",
    "SvcPriority",
    `${priority}${priority === 0 ? " (alias mode)" : ""}`,
    at,
    2,
    "0 makes it an alias, like a CNAME allowed at the zone apex; 1 and up are service records, lowest first.",
  );
  G.f(
    "target",
    "TargetName",
    target.name === "<Root>" ? ". (the owner name itself)" : target.name,
    at + 2,
    target.size,
  );
  for (let i = at + 2 + target.size; i + 4 <= at + len;) {
    const key = s.u16(i);
    const n = s.u16(i + 2);
    const v = s.sub(i + 4, n);
    let text = `${n} bytes`;
    let why: string | undefined;
    if (key === 1) {
      const ids: string[] = [];
      for (let k = 0; k < n;) {
        const l = v.u8(k);
        ids.push(new TextDecoder().decode(v.bytes(k + 1, l)));
        k += 1 + l;
      }
      text = ids.join(",");
      why =
        "The protocols the server speaks. h3 means HTTP/3 over QUIC on UDP 443: the browser can try it first, with no Alt-Svc round trip to learn it.";
    } else if (key === 4) {
      const ips: string[] = [];
      for (let k = 0; k + 4 <= n; k += 4) ips.push(ipv4(v.bytes(k, 4)));
      text = ips.join(",");
      why = "Addresses to connect to while the A query is still out: saves a lookup's wait.";
    } else if (key === 6) {
      const ips: string[] = [];
      for (let k = 0; k + 16 <= n; k += 16) ips.push(ipv6(v.bytes(k, 16)));
      text = ips.join(",");
      why = "The same for IPv6.";
    } else if (key === 3) {
      text = `${v.u16(0)}`;
    } else if (key === 5) {
      why =
        "An Encrypted Client Hello config: the server's public key, so the browser can hide the real SNI from the network.";
    }
    out.push(`${named(SVC_KEYS, key, "key")}=${text}`);
    G.f(`p${i}`, named(SVC_KEYS, key, "key"), text, i, 4 + n, why);
    i += 4 + n;
  }
  return out.join(" ");
}

export function dissectDns(ctx: Ctx, s: Src, label: "DNS" | "mDNS" | "LLMNR") {
  header(
    ctx,
    {
      proto: "dns",
      short: label,
      name:
        label === "DNS"
          ? "Domain Name System"
          : label === "mDNS"
            ? "Multicast DNS"
            : "Link-Local Multicast Name Resolution",
      layer: "app",
      s,
      i: 0,
      n: s.length,
    },
    (F, _size, h) => {
      const id = s.u16(0);
      const flags = s.u16(2);
      const qr = (flags & 0x8000) !== 0;
      const rcode = flags & 0x0f;
      const counts = [s.u16(4), s.u16(6), s.u16(8), s.u16(10)] as const;
      h.value = qr ? "response" : "query";
      if (label === "mDNS")
        h.why =
          "Multicast DNS (RFC 6762): names ending .local, answered by the devices themselves on 224.0.0.251:5353. AirPlay, printers and Chromecasts announce themselves this way.";
      F.f(
        "id",
        "Transaction ID",
        hex16(id),
        0,
        2,
        "Pairs the response with its query. Random, with a random source port: apart from DNSSEC, the only defence against off-path cache poisoning (Kaminsky, 2008).",
      );
      F.group(
        "flags",
        "Flags",
        `${hex16(flags)} ${qr ? "Standard query response" : "Standard query"}${rcode ? `, ${named(DNS_RCODES, rcode)}` : ""}`,
        2,
        2,
        undefined,
        (G) => {
          G.f("qr", "Response", qr ? "Message is a response" : "Message is a query", 2, 1);
          G.f(
            "opcode",
            "Opcode",
            `${(flags >> 11) & 0x0f}${((flags >> 11) & 0x0f) === 0 ? " (standard query)" : ""}`,
            2,
            1,
          );
          if (qr)
            G.f(
              "aa",
              "Authoritative",
              flags & 0x0400 ? "Yes" : "No: from a cache",
              2,
              1,
              "Set when the zone's own server answered. A home router or ISP resolver answers from its cache, so this is usually off.",
            );
          G.f(
            "tc",
            "Truncated",
            flags & 0x0200 ? "Yes: retry over TCP" : "No",
            2,
            1,
            "The answer didn't fit in the UDP datagram; the client retries over TCP. EDNS raises the 512-byte limit.",
          );
          G.f(
            "rd",
            "Recursion desired",
            flags & 0x0100 ? "Yes" : "No",
            2,
            1,
            "Please resolve the whole chain for me: every stub resolver sets it, and the resolver walks root, TLD and authoritative servers.",
          );
          if (qr) G.f("ra", "Recursion available", flags & 0x0080 ? "Yes" : "No", 3, 1);
          G.f(
            "ad",
            "Authenticated data",
            flags & 0x0020 ? "Yes: DNSSEC-validated" : "No",
            3,
            1,
            "The resolver validated DNSSEC signatures. Worth only as much as your trust in the resolver and the path to it: plain DNS can be rewritten on the way.",
          );
          if (qr)
            G.f(
              "rcode",
              "Reply code",
              named(DNS_RCODES, rcode),
              3,
              1,
              rcode === 3
                ? "The name does not exist. Some ISPs' resolvers lie here and return an ad server's address instead."
                : undefined,
            );
        },
      );
      F.f("qd", "Questions", `${counts[0]}`, 4, 2);
      F.f("an", "Answer RRs", `${counts[1]}`, 6, 2);
      F.f("ns", "Authority RRs", `${counts[2]}`, 8, 2);
      F.f("ar", "Additional RRs", `${counts[3]}`, 10, 2);
      let at = 12;
      const qs: string[] = [];
      const answers: string[] = [];
      for (let q = 0; q < counts[0]; q++) {
        const name = readName(s, at);
        const type = s.u16(at + name.size);
        const cls = s.u16(at + name.size + 2);
        qs.push(`${named(DNS_TYPES, type, "TYPE")} ${name.name}`);
        F.group(
          `q${q}`,
          "Query",
          `${name.name}: type ${named(DNS_TYPES, type, "TYPE")}, class ${cls & 0x7fff ? "IN" : cls}`,
          at,
          name.size + 4,
          TYPE_WHY[type],
          (G) => {
            G.f(
              "name",
              "Name",
              name.name,
              at,
              name.size,
              "Labels, each prefixed by its length; the root is the empty label at the end.",
            );
            G.f(
              "type",
              "Type",
              `${named(DNS_TYPES, type, "TYPE")} (${type})`,
              at + name.size,
              2,
              TYPE_WHY[type],
            );
            G.f(
              "class",
              "Class",
              `${(cls & 0x7fff) === 1 ? "IN" : cls & 0x7fff}${label === "mDNS" && cls & 0x8000 ? ", unicast response requested" : ""}`,
              at + name.size + 2,
              2,
            );
          },
        );
        at += name.size + 4;
      }
      const sections = [
        ["an", "Answer", counts[1]],
        ["ns", "Authority", counts[2]],
        ["ar", "Additional", counts[3]],
      ] as const;
      for (const [key, title, count] of sections) {
        for (let r = 0; r < count; r++) {
          const name = readName(s, at);
          const type = s.u16(at + name.size);
          const cls = s.u16(at + name.size + 2);
          const ttl = s.u32(at + name.size + 4);
          const len = s.u16(at + name.size + 8);
          const start = at;
          const rd = at + name.size + 10;
          if (type === 41) {
            F.group(
              `${key}${r}`,
              "EDNS(0)",
              `UDP payload ${cls} bytes${ttl & 0x8000 ? ", DO" : ""}`,
              start,
              name.size + 10 + len,
              "EDNS (RFC 6891): the client accepts UDP answers up to this size, and the DO bit asks for DNSSEC signatures. 1232 is the flag-day default that avoids fragmentation.",
              (G) => {
                G.f("size", "UDP payload size", `${cls}`, start + name.size + 2, 2);
                G.f("do", "DNSSEC OK", ttl & 0x8000 ? "Set" : "Not set", start + name.size + 4, 4);
              },
            );
          } else {
            let value = "";
            F.group(`${key}${r}`, title, "", start, name.size + 10 + len, TYPE_WHY[type], (G) => {
              G.f("name", "Name", name.name, start, name.size);
              G.f(
                "type",
                "Type",
                `${named(DNS_TYPES, type, "TYPE")} (${type})`,
                start + name.size,
                2,
                TYPE_WHY[type],
              );
              G.f(
                "class",
                "Class",
                (cls & 0x7fff) === 1 ? "IN" : `${cls}`,
                start + name.size + 2,
                2,
              );
              G.f(
                "ttl",
                "Time to live",
                `${ttl} s`,
                start + name.size + 4,
                4,
                "How long caches may keep it. Short TTLs (60 s or less) let a CDN steer clients quickly; long ones keep a site reachable when its DNS is down.",
              );
              G.f("rdlen", "Data length", `${len}`, start + name.size + 8, 2);
              const params: Field[] = [];
              value = rdata(
                new Fields(G.s, G.layer, `${G.prefix}.rdata`, params),
                s,
                type,
                rd,
                len,
              );
              const data = G.f(
                "rdata",
                named(DNS_TYPES, type, "Data"),
                value,
                rd,
                len,
                TYPE_WHY[type],
              );
              if (params.length) data.children = params;
            });
            const group = F.list.at(-1);
            if (group) group.value = `${name.name}: ${named(DNS_TYPES, type, "TYPE")} ${value}`;
            if (key === "an") answers.push(`${named(DNS_TYPES, type, "TYPE")} ${value}`);
          }
          at = rd + len;
        }
      }
      const kind = qr ? "Standard query response" : "Standard query";
      const error = qr && rcode ? ` ${named(DNS_RCODES, rcode)}` : "";
      top(
        ctx,
        label,
        `${kind} ${hex16(id)}${error} ${qs.join(", ")}${answers.length ? ` ${answers.join(" ")}` : ""}`,
      );
    },
  );
}
