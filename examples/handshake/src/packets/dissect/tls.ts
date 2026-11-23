/**
 * TLS: records over TCP (with a record split across segments followed to its end), and the handshake messages a
 * network can still read: ClientHello and ServerHello, every extension by name, cipher suites, groups (the
 * post-quantum hybrids included) and QUIC's transport parameters. The same handshake reader serves QUIC's CRYPTO
 * frames. Everything after the key exchange is marked encrypted, with why it can't be read.
 */
import { hex, hex16, type Src } from "../bytes";
import {
  CIPHER_SUITES,
  GROUPS,
  isGrease,
  named,
  SIG_SCHEMES,
  TLS_CONTENT,
  TLS_EXTENSIONS,
  TLS_HANDSHAKE,
  TLS_VERSIONS,
} from "../names";
import { header, top, type Ctx, type Fields, type TlsDir } from "./core";

export function looksLikeTls(s: Src): boolean {
  const b = s.b;
  return b.length >= 5 && (b[0] ?? 0) >= 20 && (b[0] ?? 0) <= 23 && b[1] === 3 && (b[2] ?? 9) <= 4;
}

export const ENCRYPTED_WHY =
  "Encrypted with keys from the handshake's key exchange: without them, or the browser's SSLKEYLOGFILE, nobody on the path can read it, this tool and your ISP included. The record's length still shows.";

const TLS13_HIDDEN =
  " In TLS 1.3 the rest of the handshake, the certificate included, travels inside these records too: only the outer type, Application Data, shows.";

const name16 = (table: Record<number, string>, v: number) =>
  isGrease(v) ? `GREASE (${hex16(v)})` : `${table[v] ?? "Unknown"} (${hex16(v)})`;

const versionName = (v: number) =>
  isGrease(v) ? `GREASE (${hex16(v)})` : `${TLS_VERSIONS[v] ?? "Unknown"} (${hex16(v)})`;

/** What a handshake reader found, for the Info line and the connection's state. */
export interface HelloSummary {
  info: string[];
  /** The version a ServerHello chose (supported_versions, or its legacy field). */
  version?: number;
  sni?: string;
}

const EXT_WHY: Record<number, string> = {
  0: "SNI: the site's name in clear text, so a server on a shared address can pick the right certificate. It is how networks and censors see which site you visit over HTTPS; Encrypted Client Hello hides it.",
  5: "OCSP stapling: the server sends its certificate's revocation status itself, so the browser doesn't ask the CA, which would tell the CA what you visit.",
  10: "Key exchange groups, in preference order. X25519MLKEM768 is the hybrid post-quantum one Chrome, Firefox and Cloudflare now default to: X25519 plus ML-KEM-768, so a quantum computer later can't decrypt a recording of today's traffic.",
  11: "Legacy elliptic-curve point formats: uncompressed is the only one anyone uses.",
  13: "How the server may sign the handshake to prove it holds the certificate's private key.",
  16: "ALPN: which protocol runs inside. h2 or http/1.1 over TCP, h3 over QUIC. In TLS 1.3 the server's choice comes back encrypted.",
  18: "Asks for Certificate Transparency proofs: evidence the certificate is in public logs, so a mis-issued one can be spotted.",
  21: "Pads the hello past 512 bytes, around a bug in some load balancers that choked on hellos 256 to 511 bytes long (RFC 7685).",
  23: "Binds the keys to the whole handshake, closing TLS 1.2's triple-handshake attack. Implied in TLS 1.3.",
  27: "Lets the server compress its certificate chain (brotli or zlib): fewer bytes in the server's first flight, which matters for QUIC's amplification limit.",
  35: "TLS 1.2 session resumption by ticket. TLS 1.3 uses pre_shared_key instead.",
  41: "Resumption: a ticket from an earlier connection. Always the last extension, because its binder signs everything before it.",
  42: "0-RTT: application data sent with the first flight. Fast, but replayable, so only for idempotent requests.",
  43: "The real version negotiation in TLS 1.3: the legacy version field is frozen at 1.2 because middleboxes broke on anything higher.",
  45: "psk_dhe_ke: a resumed connection still does a fresh key exchange, for forward secrecy.",
  51: "The client guesses which group the server will pick and sends its public key now. A right guess makes the handshake one round trip; a wrong one costs a HelloRetryRequest and another.",
  57: "QUIC's own settings, carried inside TLS so they are authenticated by the handshake: flow-control limits, idle timeout, the connection IDs.",
  17513: "ALPS: HTTP/2 or HTTP/3 settings sent during the handshake, a Chrome extension.",
  17613: "ALPS: HTTP/2 or HTTP/3 settings sent during the handshake, a Chrome extension.",
  65037:
    "Encrypted Client Hello (or GREASE for it): the real hello, SNI included, encrypted to a key from the server's DNS HTTPS record.",
  65281:
    "Secure renegotiation (RFC 5746). Empty in a fresh handshake; TLS 1.3 has no renegotiation at all.",
};

const TP_NAMES: Record<number, string> = {
  0x00: "original_destination_connection_id",
  0x01: "max_idle_timeout",
  0x02: "stateless_reset_token",
  0x03: "max_udp_payload_size",
  0x04: "initial_max_data",
  0x05: "initial_max_stream_data_bidi_local",
  0x06: "initial_max_stream_data_bidi_remote",
  0x07: "initial_max_stream_data_uni",
  0x08: "initial_max_streams_bidi",
  0x09: "initial_max_streams_uni",
  0x0a: "ack_delay_exponent",
  0x0b: "max_ack_delay",
  0x0c: "disable_active_migration",
  0x0e: "active_connection_id_limit",
  0x0f: "initial_source_connection_id",
  0x10: "retry_source_connection_id",
  0x20: "max_datagram_frame_size",
  0x2ab2: "grease_quic_bit",
};

const TP_WHY: Record<number, string> = {
  0x01: "Close the connection after this long with no packets. Shorter than a NAT's UDP timeout, or the app must send PINGs.",
  0x04: "Connection-level flow control: bytes the peer may send in total before more credit is granted.",
  0x0f: "Repeats the SCID inside the authenticated handshake, so an attacker can't swap the connection IDs.",
  0x0c: "This side won't follow a migration to a new address (a phone moving from Wi-Fi to cellular).",
};

function transportParams(G: Fields, s: Src, from: number, to: number) {
  let at = from;
  while (at < to) {
    const id = s.varint(at);
    const len = s.varint(at + id.size);
    const v = at + id.size + len.size;
    const greaseId = id.value > 0x20 && (id.value - 27) % 31 === 0;
    const pname = greaseId ? "GREASE" : (TP_NAMES[id.value] ?? `0x${id.value.toString(16)}`);
    let value = `${len.value} bytes`;
    if ([0x00, 0x0f, 0x10].includes(id.value))
      value = len.value ? hex(s.bytes(v, len.value)) : "(empty)";
    else if (len.value > 0 && len.value <= 8 && id.value !== 0x02 && !greaseId) {
      const n = s.varint(v).value;
      value = id.value === 0x01 || id.value === 0x0b ? `${n} ms` : n.toLocaleString("en");
    } else if (len.value === 0) value = "(present)";
    G.f(`tp${at}`, pname, value, at, id.size + len.size + len.value, TP_WHY[id.value]);
    at = v + len.value;
  }
}

function extension(
  G: Fields,
  s: Src,
  at: number,
  type: number,
  len: number,
  out: HelloSummary,
  server: boolean,
) {
  const d = at + 4;
  const ext = isGrease(type) ? "GREASE" : (TLS_EXTENSIONS[type] ?? `unknown ${type}`);
  const why = isGrease(type)
    ? "GREASE (RFC 8701): a reserved value sent so servers keep tolerating ones they don't know."
    : EXT_WHY[type];
  const total = len + 4;
  const key = `ext${at}`;
  const group = (value: string, body?: (E: Fields) => void) =>
    G.group(key, `Extension: ${ext}`, value, at, total, why, (E) => {
      E.f("type", "Type", `${ext} (${type})`, at, 2);
      E.f("len", "Length", `${len}`, at + 2, 2);
      body?.(E);
    });
  switch (type) {
    case 0: {
      if (len === 0) return group("(empty: the server used the SNI)");
      const n = s.u16(d + 3);
      const host = new TextDecoder().decode(s.bytes(d + 5, n));
      out.sni = host;
      return group(host, (E) => E.f("host", "Server name", host, d + 5, n, EXT_WHY[0]));
    }
    case 10: {
      const list: string[] = [];
      for (let i = d + 2; i < d + 2 + s.u16(d); i += 2)
        list.push(name16(GROUPS, s.u16(i)).replace(/ \(0x[0-9a-f]+\)$/, ""));
      return group(list.join(", "), (E) => {
        for (let i = d + 2, k = 0; i < d + 2 + s.u16(d); i += 2, k++)
          E.f(`g${k}`, "Group", name16(GROUPS, s.u16(i)), i, 2);
      });
    }
    case 13: {
      const list: string[] = [];
      for (let i = d + 2; i < d + 2 + s.u16(d); i += 2) list.push(name16(SIG_SCHEMES, s.u16(i)));
      return group(`${list.length} schemes`, (E) => {
        list.forEach((x, k) => E.f(`s${k}`, "Signature scheme", x, d + 2 + k * 2, 2));
      });
    }
    case 16: {
      const list: string[] = [];
      for (let i = d + 2; i < d + 2 + s.u16(d);) {
        const n = s.u8(i);
        list.push(new TextDecoder().decode(s.bytes(i + 1, n)));
        i += 1 + n;
      }
      return group(list.join(", "), (E) => {
        let i = d + 2;
        for (const [k, p] of list.entries()) {
          E.f(
            `p${k}`,
            "Protocol",
            p,
            i,
            1 + p.length,
            p === "h3"
              ? "HTTP/3: only over QUIC."
              : p === "h2"
                ? "HTTP/2: many requests multiplexed on this one TCP connection."
                : undefined,
          );
          i += 1 + p.length;
        }
      });
    }
    case 43: {
      if (server) {
        const v = s.u16(d);
        out.version = v;
        return group(versionName(v), (E) =>
          E.f(
            "selected",
            "Selected version",
            versionName(v),
            d,
            2,
            v === 0x0304
              ? "TLS 1.3. From here on every handshake message is encrypted with handshake keys: the certificate included."
              : undefined,
          ),
        );
      }
      const list: string[] = [];
      for (let i = d + 1; i < d + 1 + s.u8(d); i += 2) list.push(versionName(s.u16(i)));
      return group(list.join(", "), (E) =>
        list.forEach((x, k) => E.f(`v${k}`, "Supported version", x, d + 1 + k * 2, 2)),
      );
    }
    case 51: {
      if (server) {
        const g = s.u16(d);
        const n = len >= 4 ? s.u16(d + 2) : 0;
        return group(name16(GROUPS, g), (E) => {
          E.f(
            "group",
            "Group",
            name16(GROUPS, g),
            d,
            2,
            "The group the server chose from the client's shares.",
          );
          if (n)
            E.f(
              "key",
              "Key exchange",
              `${n} bytes`,
              d + 4,
              n,
              g === 0x11ec
                ? "1,120 bytes: an ML-KEM-768 ciphertext (1,088) and an X25519 share (32)."
                : "The server's ephemeral public key: with the client's, both sides now share a secret nobody on the path saw.",
            );
        });
      }
      const shares: string[] = [];
      return group("", (E) => {
        for (let i = d + 2, k = 0; i < d + 2 + s.u16(d); k++) {
          const g = s.u16(i);
          const n = s.u16(i + 2);
          shares.push(name16(GROUPS, g).replace(/ \(0x[0-9a-f]+\)$/, ""));
          E.group(
            `ks${k}`,
            "Key share entry",
            `${name16(GROUPS, g)}, ${n} bytes`,
            i,
            4 + n,
            g === 0x11ec
              ? "1,216 bytes: an ML-KEM-768 encapsulation key (1,184) and an X25519 share (32). Big enough that a Chrome ClientHello no longer fits one packet."
              : undefined,
            (K) => {
              K.f("group", "Group", name16(GROUPS, g), i, 2);
              K.f("key", "Key exchange", `${n} bytes`, i + 4, n);
            },
          );
          i += 4 + n;
        }
        const ext = G.list.at(-1);
        if (ext) ext.value = shares.join(", ");
      });
    }
    case 45: {
      const modes = Array.from(s.bytes(d + 1, s.u8(d)), (m) =>
        m === 1 ? "psk_dhe_ke" : m === 0 ? "psk_ke" : `${m}`,
      );
      return group(modes.join(", "));
    }
    case 57:
      return group(`${len} bytes`, (E) => transportParams(E, s, d, d + len));
    case 11:
      return group(
        Array.from(s.bytes(d + 1, s.u8(d)), (f) => (f === 0 ? "uncompressed" : `${f}`)).join(", "),
      );
    default:
      return group(len ? `${len} bytes` : "(empty)");
  }
}

/** The fields of ClientHello and ServerHello; other handshake messages by name and length. */
function hello(F: Fields, s: Src, at: number, type: number, len: number, out: HelloSummary) {
  const server = type === 2;
  const d = at + 4;
  const random = s.bytes(d + 2, 32);
  const hrr =
    server && hex(random) === "cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c";
  F.f(
    "version",
    "Legacy version",
    versionName(s.u16(d)),
    d,
    2,
    "Frozen at TLS 1.2 (0x0303): middleboxes broke on anything higher, so TLS 1.3 negotiates in supported_versions instead.",
  );
  F.f(
    "random",
    "Random",
    hex(random),
    d + 2,
    32,
    hrr
      ? "This fixed value (SHA-256 of 'HelloRetryRequest') makes it a HelloRetryRequest: the server wants a key share for another group."
      : server
        ? "The server's 32 random bytes. If they end in DOWNGRD, a TLS 1.3 server was forced down to 1.2 and the client must abort."
        : "32 random bytes from the client that feed key derivation.",
  );
  const sidLen = s.u8(d + 34);
  F.f(
    "sid",
    "Legacy session ID",
    sidLen ? hex(s.bytes(d + 35, sidLen)) : "(empty)",
    d + 34,
    1 + sidLen,
    server
      ? "Echoes the client's, as TLS 1.2 resumption would."
      : "32 random bytes in TLS 1.3, so the hello looks like a TLS 1.2 resumption to middleboxes (compatibility mode).",
  );
  let i = d + 35 + sidLen;
  if (server) {
    const suite = s.u16(i);
    F.f(
      "suite",
      "Cipher suite",
      name16(CIPHER_SUITES, suite),
      i,
      2,
      "The server's choice. AES-GCM wins on any CPU with AES instructions; ChaCha20-Poly1305 on phones without them.",
    );
    F.f(
      "compression",
      "Compression method",
      s.u8(i + 2) === 0 ? "null (0)" : `${s.u8(i + 2)}`,
      i + 2,
      1,
    );
    i += 3;
  } else {
    const n = s.u16(i);
    F.group(
      "suites",
      "Cipher suites",
      `${n / 2} suites`,
      i,
      2 + n,
      "Offered in preference order. The TLS_AES_* and TLS_CHACHA20_* ones are TLS 1.3's: their names carry no key exchange, which moved to key_share.",
      (G) => {
        for (let k = 0; k < n; k += 2)
          G.f(`c${k}`, "Cipher suite", name16(CIPHER_SUITES, s.u16(i + 2 + k)), i + 2 + k, 2);
      },
    );
    i += 2 + n;
    const c = s.u8(i);
    F.f(
      "compression",
      "Compression methods",
      `${c} (null)`,
      i,
      1 + c,
      "Must be null: TLS compression made the CRIME attack possible.",
    );
    i += 1 + c;
  }
  if (i >= d + len) return hrr;
  const extLen = s.u16(i);
  F.group("extensions", "Extensions", `${extLen} bytes`, i, 2 + extLen, undefined, (G) => {
    for (let e = i + 2; e < i + 2 + extLen;) {
      const et = s.u16(e);
      const el = s.u16(e + 2);
      extension(G, s, e, et, el, out, server);
      e += 4 + el;
    }
  });
  return hrr;
}

/**
 * Handshake messages from `at` to `end` in `s` (a record's body, or a QUIC CRYPTO frame's data). A message running
 * past the end is read as far as it goes and marked.
 */
export function handshakes(F: Fields, s: Src, at: number, end: number, out: HelloSummary) {
  for (let m = at; m + 4 <= end;) {
    const type = s.u8(m);
    const len = s.u24(m + 1);
    const label = TLS_HANDSHAKE[type] ?? `Handshake type ${type}`;
    const whole = m + 4 + len <= end;
    let shown = label;
    F.group(
      `hs${m}`,
      `Handshake: ${label}`,
      `${len} bytes${whole ? "" : ", continues past these bytes"}`,
      m,
      Math.min(4 + len, end - m),
      undefined,
      (G) => {
        G.f("type", "Handshake type", `${label} (${type})`, m, 1);
        G.f("len", "Length", `${len}`, m + 1, 3);
        if (type === 1 || type === 2) {
          const hrr = hello(G, s, m, type, len, out);
          if (hrr) shown = "Hello Retry Request";
        }
        if (!whole)
          G.note(
            "partial",
            "Continues",
            "in later bytes",
            "The message is longer than what is here: it continues in the next record, segment or packet.",
          );
      },
    );
    out.info.push(shown === "Client Hello" && out.sni ? `Client Hello (SNI=${out.sni})` : shown);
    m += 4 + len;
  }
}

const otherDir = (key: string) => key.replace(/:(\d)$/, (_, d: string) => `:${d === "0" ? 1 : 0}`);

export function dissectTls(ctx: Ctx, s: Src, dirKey: string, prefix: string) {
  let state = ctx.session.tls.get(dirKey);
  if (!state) {
    state = { pending: 0, pendingType: 0, encrypted: false };
    ctx.session.tls.set(dirKey, state);
  }
  const peer = ctx.session.tls.get(otherDir(dirKey));
  const info: string[] = [];
  let version = state.version ?? peer?.version;
  let at = 0;
  const st: TlsDir = state;
  header(
    ctx,
    {
      proto: "tls",
      short: "TLS",
      name: "Transport Layer Security",
      layer: "app",
      s,
      i: 0,
      n: s.length,
    },
    (F, _size, h) => {
      if (st.pending > 0) {
        const take = Math.min(st.pending, s.length);
        const enc = st.pendingType === 23 || st.encrypted;
        F.as(enc ? "crypt" : "app").f(
          `cont`,
          "Record continued",
          `${take.toLocaleString("en")} bytes of a ${named(TLS_CONTENT, st.pendingType)} record begun earlier`,
          0,
          take,
          enc
            ? ENCRYPTED_WHY
            : "A record is up to 16 KB, a segment at most one MSS: TCP cuts records wherever it likes.",
        );
        st.pending -= take;
        at = take;
        info.push(`${named(TLS_CONTENT, st.pendingType)} (continued)`);
      }
      while (at + 5 <= s.length) {
        const type = s.u8(at);
        const rv = s.u16(at + 1);
        const len = s.u16(at + 3);
        const body = at + 5;
        const end = Math.min(body + len, s.length);
        const whole = body + len <= s.length;
        const content = named(TLS_CONTENT, type, "Record type");
        const encrypted = type === 23 || (st.encrypted && type !== 20);
        const label =
          type === 23
            ? "Application Data"
            : encrypted && type === 22
              ? "Encrypted Handshake Message"
              : encrypted && type === 21
                ? "Encrypted Alert"
                : content;
        F.group(
          `rec${at}`,
          `Record: ${label}`,
          `${len} bytes${whole ? "" : ", continues in the next segment"}`,
          at,
          end - at,
          type === 20
            ? "Meaningless in TLS 1.3: sent only so middleboxes that expect TLS 1.2 let the connection through (RFC 8446 Appendix D.4)."
            : undefined,
          (G) => {
            G.f(
              "type",
              "Content type",
              `${content} (${type})`,
              at,
              1,
              type === 23 && version === 0x0304 ? `${ENCRYPTED_WHY}${TLS13_HIDDEN}` : undefined,
            );
            G.f(
              "version",
              "Legacy record version",
              versionName(rv),
              at + 1,
              2,
              "Meaningless: 0x0301 on a first ClientHello (for old servers), 0x0303 after. The real version is in supported_versions.",
            );
            G.f(
              "len",
              "Length",
              `${len}`,
              at + 3,
              2,
              type === 23
                ? "Encrypted, but not hidden: lengths and timing leak which page was fetched (traffic analysis)."
                : undefined,
            );
            if (encrypted) {
              G.as("crypt").f(
                "data",
                label,
                `${len} bytes`,
                body,
                end - body,
                version === 0x0304 && type === 23
                  ? `${ENCRYPTED_WHY}${TLS13_HIDDEN}`
                  : ENCRYPTED_WHY,
              );
            } else if (type === 22) {
              const summary: HelloSummary = { info: [] };
              handshakes(G, s, body, end, summary);
              if (summary.version) version = summary.version;
              if (
                summary.info.some((x) => x === "Server Hello") &&
                (summary.version ?? rv) === 0x0304
              ) {
                // TLS 1.3: after ServerHello both sides switch to handshake keys.
                st.encrypted = true;
                if (peer) peer.encrypted = true;
              }
              info.push(...summary.info);
              return;
            } else if (type === 20) {
              G.f("ccs", "Change Cipher Spec message", `${s.u8(body)}`, body, 1);
              st.encrypted = true;
            } else if (type === 21) {
              G.f("level", "Level", s.u8(body) === 2 ? "Fatal (2)" : "Warning (1)", body, 1);
              G.f("desc", "Description", `${s.u8(body + 1)}`, body + 1, 1);
            }
            info.push(label);
          },
        );
        if (!whole) {
          st.pending = body + len - s.length;
          st.pendingType = type;
        }
        at = body + len;
      }
      state.version = version;
      if (peer) peer.version = version;
      h.value = info.join(", ");
    },
  );
  const proto = version ? (TLS_VERSIONS[version] ?? "TLS").replace("TLS ", "TLSv") : "TLS";
  top(ctx, proto, `${prefix}${info.join(", ")}`);
}
