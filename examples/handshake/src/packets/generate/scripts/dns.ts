/** The bundled capture “Looking up a name”. */
import { dns, udp } from "../build";
import { HOSTS, L, R, Tape, v4, type Bundled, type Script } from "./tape";

function dnsCapture(): Script {
  const tape = new Tape(600, "pcap");
  const ids = new Map<string, number>();
  const name = "www.example.com";
  const q = (port: number, payload: Uint8Array) =>
    v4("laptop", L.ip, R.ip, 17, udp(L.ip, R.ip, port, 53, payload), ids);
  const a = (port: number, payload: Uint8Array) =>
    v4("router", R.ip, L.ip, 17, udp(R.ip, L.ip, 53, port, payload), ids);
  const cname = { name: 12, type: "CNAME", ttl: 300, target: "edge.example.net" } as const;
  // A browser asks for A, AAAA and HTTPS at once; the router's resolver goes upstream for each.
  tape.add(
    0,
    q(51812, dns({ id: 0x3c1a, response: false, question: { name, type: "A" }, edns: 1232 })),
    "query-a",
  );
  tape.add(
    0.3,
    q(60251, dns({ id: 0x9e04, response: false, question: { name, type: "AAAA" }, edns: 1232 })),
    "query-aaaa",
  );
  tape.add(
    0.5,
    q(49533, dns({ id: 0x71b7, response: false, question: { name, type: "HTTPS" }, edns: 1232 })),
    "query-https",
  );
  tape.add(
    27.8,
    a(
      51812,
      dns({
        id: 0x3c1a,
        response: true,
        question: { name, type: "A" },
        answers: [cname, { name: "edge.example.net", type: "A", ttl: 60, addr: HOSTS.quic }],
        edns: 1232,
      }),
    ),
    "response-a",
  );
  tape.add(
    29.1,
    a(
      49533,
      dns({
        id: 0x71b7,
        response: true,
        question: { name, type: "HTTPS" },
        answers: [
          cname,
          {
            name: "edge.example.net",
            type: "HTTPS",
            ttl: 60,
            priority: 1,
            alpn: ["h3", "h2"],
            v4: [HOSTS.quic],
            v6: ["2001:db8:80::80"],
          },
        ],
        edns: 1232,
      }),
    ),
    "response-https",
  );
  tape.add(
    31.4,
    a(
      60251,
      dns({
        id: 0x9e04,
        response: true,
        question: { name, type: "AAAA" },
        answers: [
          cname,
          { name: "edge.example.net", type: "AAAA", ttl: 60, addr: "2001:db8:80::80" },
        ],
        edns: 1232,
      }),
    ),
    "response-aaaa",
  );
  // The same name a second later: answered from the router's cache, in 2 ms instead of 28.
  tape.add(
    1200.0,
    q(57340, dns({ id: 0xa52e, response: false, question: { name, type: "A" }, edns: 1232 })),
    "query-cached",
  );
  tape.add(
    1201.9,
    a(
      57340,
      dns({
        id: 0xa52e,
        response: true,
        question: { name, type: "A" },
        answers: [
          { ...cname, ttl: 299 },
          { name: "edge.example.net", type: "A", ttl: 59, addr: HOSTS.quic },
        ],
        edns: 1232,
      }),
    ),
    "response-cached",
  );
  // Mail and policy records for the domain.
  tape.add(
    2400.0,
    q(
      50112,
      dns({
        id: 0x1f90,
        response: false,
        question: { name: "example.com", type: "MX" },
        edns: 1232,
      }),
    ),
    "query-mx",
  );
  tape.add(
    2424.6,
    a(
      50112,
      dns({
        id: 0x1f90,
        response: true,
        question: { name: "example.com", type: "MX" },
        answers: [{ name: 12, type: "MX", ttl: 3600, pref: 10, target: "mail.example.com" }],
        edns: 1232,
      }),
    ),
    "response-mx",
  );
  tape.add(
    2500.0,
    q(
      53007,
      dns({
        id: 0x6d33,
        response: false,
        question: { name: "example.com", type: "TXT" },
        edns: 1232,
      }),
    ),
    "query-txt",
  );
  tape.add(
    2523.2,
    a(
      53007,
      dns({
        id: 0x6d33,
        response: true,
        question: { name: "example.com", type: "TXT" },
        answers: [
          { name: 12, type: "TXT", ttl: 3600, text: ["v=spf1 -all"] },
          { name: 12, type: "TXT", ttl: 3600, text: ["site-verification=4c9f2b7e"] },
        ],
        edns: 1232,
      }),
    ),
    "response-txt",
  );
  // A name that doesn't exist: the proxy auto-discovery lookup many OSes still make on every network.
  tape.add(
    3100.0,
    q(
      61420,
      dns({ id: 0xc7d1, response: false, question: { name: "wpad.lan", type: "A" }, edns: 1232 }),
    ),
    "query-nxdomain",
  );
  tape.add(
    3101.4,
    a(
      61420,
      dns({
        id: 0xc7d1,
        response: true,
        rcode: 3,
        question: { name: "wpad.lan", type: "A" },
        authority: [
          {
            name: "lan",
            type: "SOA",
            ttl: 300,
            mname: "router.lan",
            rname: "hostmaster.lan",
            serial: 2026112301,
          },
        ],
        edns: 1232,
      }),
    ),
    "response-nxdomain",
  );
  return tape.script;
}

export const dnsLookup: Bundled = {
  title: "Looking up a name",
  summary:
    "A browser resolves www.example.com: A, AAAA and HTTPS queries at once to the router's resolver. The answers follow a CNAME to a CDN edge, and the HTTPS record says alpn=h3,h2, so the browser can go straight to HTTP/3. The same lookup a second later comes from the router's cache in 2 ms instead of 28; then MX and TXT records, and an NXDOMAIN for the wpad.lan lookup many systems still make.",
  build: dnsCapture,
};
