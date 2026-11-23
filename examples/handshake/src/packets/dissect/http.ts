/**
 * HTTP/1.x over TCP: the request or status line, each header with why it matters, and the body. Bodies that run on
 * across segments are followed by their Content-Length, so the next segment reads as a continuation, not garbage.
 */
import { ascii, type Src } from "../bytes";
import { header, top, type Ctx } from "./core";

const METHODS = ["GET ", "POST ", "HEAD ", "PUT ", "DELETE ", "OPTIONS ", "PATCH ", "CONNECT "];

export function looksLikeHttp(s: Src): boolean {
  const head = ascii(s.b.subarray(0, 8));
  return head.startsWith("HTTP/1.") || METHODS.some((m) => head.startsWith(m));
}

const HEADER_WHY: Record<string, string> = {
  host: "Which site on this address: one IP serves many sites, so HTTP/1.1 made it mandatory. Over plain HTTP everyone on the path reads it, and the path, and the cookies.",
  "user-agent":
    "The client's self-description. Browsers now freeze most of it and move the details to Client Hints, because it fingerprinted people.",
  connection:
    "keep-alive, the default since HTTP/1.1, reuses this TCP connection for the next request and saves a handshake; close ends it after the response.",
  "content-length":
    "The body's size in bytes: how the receiver knows where this message ends and the next begins on a kept-alive connection.",
  "transfer-encoding":
    "chunked: the size isn't known up front, so the body comes in length-prefixed chunks ending with an empty one.",
  "cache-control":
    "Who may cache the response and for how long: the browser and every CDN on the way read it.",
  server:
    "The server's software, often with a version: free reconnaissance, so many servers trim it.",
  "alt-svc":
    'Advertises HTTP/3: h3=":443" says this origin also speaks QUIC on UDP 443. The browser switches on a later request, a round trip the DNS HTTPS record would have saved.',
  etag: "A version tag: next time the browser sends If-None-Match and gets 304 Not Modified, with no body, if nothing changed.",
  "accept-encoding": "The compressions the client can undo: br and zstd beat gzip on text.",
  "set-cookie":
    "State for the next request. Over plain HTTP it crosses the network readable, which is what Secure cookies and HSTS exist to stop.",
  "content-type":
    "What the body is; with X-Content-Type-Options: nosniff, the browser believes it instead of guessing.",
  date: "The server's clock. Caches compute age from it.",
  "strict-transport-security":
    "HSTS: use HTTPS for this host for max-age seconds, even if a link says http://.",
  upgrade: "Switch protocols on this connection: how WebSockets start.",
};

export function dissectHttp(ctx: Ctx, s: Src, dirKey: string, prefix: string) {
  const remaining = ctx.session.httpBody.get(dirKey) ?? 0;
  if (remaining > 0 && !looksLikeHttp(s)) {
    const take = Math.min(remaining, s.length);
    ctx.session.httpBody.set(dirKey, remaining - take);
    if (remaining - take === 0) ctx.session.httpBody.delete(dirKey);
    header(
      ctx,
      {
        proto: "http",
        short: "HTTP",
        name: "Hypertext Transfer Protocol",
        layer: "app",
        s,
        i: 0,
        n: take,
      },
      (F, _size, h) => {
        h.value = "continuation";
        F.f(
          "body",
          "Body (continued)",
          `${take.toLocaleString("en")} bytes${remaining - take ? `, ${(remaining - take).toLocaleString("en")} still to come` : ", the last"}`,
          0,
          take,
          "The rest of a body whose Content-Length the response's headers gave: TCP cut it into segments of at most one MSS.",
        );
      },
    );
    top(ctx, "HTTP", `${prefix}Continuation`);
    return;
  }
  const text = ascii(s.b);
  const end = text.indexOf("\r\n\r\n");
  const headLen = end >= 0 ? end + 4 : s.length;
  let info = "";
  header(
    ctx,
    {
      proto: "http",
      short: "HTTP",
      name: "Hypertext Transfer Protocol",
      layer: "app",
      s,
      i: 0,
      n: s.length,
    },
    (F, _size, h) => {
      const lines = text.slice(0, end >= 0 ? end : s.length).split("\r\n");
      let at = 0;
      let length = 0;
      const first = lines[0] ?? "";
      info = first;
      if (first.startsWith("HTTP/")) {
        const [version = "", code = "", ...reason] = first.split(" ");
        h.value = `${code} ${reason.join(" ")}`;
        F.group("status", "Status line", first, 0, first.length + 2, undefined, (G) => {
          G.f("version", "Version", version, 0, version.length);
          G.f(
            "code",
            "Status code",
            code,
            version.length + 1,
            code.length,
            code.startsWith("3")
              ? "A redirect: the browser repeats the request at Location, one more round trip, plus a new connection if the host changes."
              : code === "304"
                ? "Not modified: the cached copy is still good; no body follows."
                : undefined,
          );
          G.f(
            "reason",
            "Reason phrase",
            reason.join(" "),
            version.length + code.length + 2,
            reason.join(" ").length,
            "Free text for people. HTTP/2 and 3 dropped it.",
          );
        });
      } else {
        const [method = "", target = "", version = ""] = first.split(" ");
        h.value = `${method} ${target}`;
        F.group("request", "Request line", first, 0, first.length + 2, undefined, (G) => {
          G.f(
            "method",
            "Method",
            method,
            0,
            method.length,
            method === "GET"
              ? "Safe and idempotent: it may be retried and cached, and must not change anything on the server."
              : undefined,
          );
          G.f("target", "Target", target, method.length + 1, target.length);
          G.f(
            "version",
            "Version",
            version,
            method.length + target.length + 2,
            version.length,
            "HTTP/1.1: one request at a time per connection, so browsers open six per host. HTTP/2 multiplexes; HTTP/3 does it over QUIC.",
          );
        });
      }
      at = first.length + 2;
      for (const line of lines.slice(1)) {
        const colon = line.indexOf(":");
        const name = colon > 0 ? line.slice(0, colon) : line;
        const value = colon > 0 ? line.slice(colon + 1).trim() : "";
        const key = name.toLowerCase();
        if (key === "content-length") length = Number(value) || 0;
        F.f(`h_${key}_${at}`, name, value, at, line.length + 2, HEADER_WHY[key]);
        at += line.length + 2;
      }
      if (end < 0) {
        F.note(
          "more",
          "Headers continue",
          "in the next segment",
          "The header block didn't end in this segment: reassembly across segments is not attempted here.",
        );
        return;
      }
      F.f("blank", "End of headers", "\\r\\n", end + 2, 2);
      const body = s.length - headLen;
      if (body > 0) {
        F.f(
          "body",
          "Body",
          `${body.toLocaleString("en")} bytes${length > body ? ` of ${length.toLocaleString("en")}` : ""}`,
          headLen,
          body,
          length > body
            ? "The first part of the body: the rest follows in the next segments, each at most one MSS."
            : undefined,
        );
      }
      if (length > body) ctx.session.httpBody.set(dirKey, length - body);
    },
  );
  top(ctx, "HTTP", `${prefix}${info}`);
}
