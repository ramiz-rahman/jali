import { describe, expect, it } from "vitest";
import { GLOSSARY } from "./glossary";
import { LESSONS } from "./lessons";
import { parseBody, parseInline, termsIn } from "./markup";
import { captureMark } from "#src/packets/captures.ts";
import { resolveTarget } from "./refs";
import type { Target } from "./types";

/** The marks the brief promises each bundled capture exports. A mark outside this table is a typo. */
const CONTRACT: Record<string, string[]> = {
  "home-lan": [
    "arp-request",
    "arp-reply",
    "dhcp-discover",
    "dhcp-offer",
    "dhcp-request",
    "dhcp-ack",
  ],
  dns: ["query-a", "response-a", "query-https", "response-https"],
  "tcp-lifecycle": [
    "syn",
    "syn-ack",
    "ack",
    "request",
    "response-first",
    "dup-ack",
    "retransmission",
    "window-update",
    "fin",
    "last-ack",
  ],
  tls13: ["syn", "client-hello", "server-hello", "change-cipher-spec", "first-encrypted"],
  "quic-h3": ["client-initial", "server-initial", "handshake", "first-1rtt"],
  traceroute: ["ttl-1", "exceeded-1", "ttl-2", "exceeded-2", "final-reply"],
};
const SAMPLE_SCANS = new Set(["sample-wifi", "sample-devices", "sample-path"]);
const markOf = (capture: string, mark: string) => {
  const i = CONTRACT[capture]?.indexOf(mark);
  return i === undefined || i < 0 ? undefined : i + 1;
};

const ids = new Set(GLOSSARY.map((g) => g.id));
/** A target's params as one record: a packet mark's capture, or a ref's own params. */
const paramsOf = (t: Target): Record<string, unknown> =>
  "mark" in t ? { capture: t.capture } : t.params;
const text = (v: unknown) => (typeof v === "string" ? v : "");
const linksOf = (entries: readonly string[]) => termsIn(parseBody(entries));

const targets = (): { where: string; target: Target }[] =>
  LESSONS.flatMap((l) =>
    l.steps.flatMap((s, i) => [
      ...(s.show ? [{ where: `${l.id}#${i + 1} show`, target: s.show }] : []),
      ...(s.tryIt ? [{ where: `${l.id}#${i + 1} tryIt`, target: s.tryIt.open }] : []),
    ]),
  );

describe("the lessons", () => {
  it("name the nine lessons of the brief, uniquely", () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      "encapsulation",
      "wifi",
      "home-network",
      "dns",
      "tcp",
      "bufferbloat",
      "tls",
      "quic",
      "routing",
    ]);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))(
    "%s has the shape the course promises",
    (_id, lesson) => {
      expect(lesson.steps.length).toBeGreaterThanOrEqual(6);
      expect(lesson.steps.length).toBeLessThanOrEqual(10);
      expect(lesson.check.length).toBeGreaterThanOrEqual(2);
      expect(lesson.check.length).toBeLessThanOrEqual(4);
      expect(lesson.minutes).toBeGreaterThan(0);
      // The first step must put something in the lab, or the tools stay on the previous lesson's last packet.
      expect(lesson.steps[0]?.show ?? lesson.steps[1]?.show).toBeDefined();
      for (const s of lesson.steps) {
        expect(s.title.trim()).not.toBe("");
        expect(s.body.length).toBeGreaterThan(0);
      }
    },
  );

  it("only link glossary terms that exist", () => {
    const missing: string[] = [];
    for (const l of LESSONS) {
      l.steps.forEach((s, i) => {
        for (const id of linksOf(s.body)) if (!ids.has(id)) missing.push(`${l.id}#${i + 1}: ${id}`);
        if (s.tryIt)
          for (const id of linksOf([s.tryIt.text]))
            if (!ids.has(id)) missing.push(`${l.id}#${i + 1} try: ${id}`);
      });
      l.check.forEach((c, i) => {
        for (const id of linksOf([c.q, ...c.a]))
          if (!ids.has(id)) missing.push(`${l.id} check ${i + 1}: ${id}`);
      });
    }
    expect(missing).toEqual([]);
  });

  it("point at captures, marks and scans that exist", () => {
    for (const { where, target } of targets()) {
      const r = resolveTarget(target, markOf);
      expect(r.ok, `${where}: ${r.ok ? "" : r.why}`).toBe(true);
      const p = paramsOf(target);
      if (p.scan !== undefined)
        expect(SAMPLE_SCANS.has(text(p.scan)), `${where}: ${p.scan}`).toBe(true);
      for (const capture of [p.capture, p.a, p.b])
        if (capture !== undefined)
          expect(CONTRACT[text(capture)], `${where}: ${capture}`).toBeDefined();
      if (p.term !== undefined) expect(ids.has(text(p.term)), `${where}: ${p.term}`).toBe(true);
    }
  });

  it("resolve a capture mark to a packet ref and report a missing one", () => {
    expect(resolveTarget({ capture: "tcp-lifecycle", mark: "syn-ack" }, markOf)).toEqual({
      ok: true,
      ref: { kind: "packet", params: { capture: "tcp-lifecycle", n: 2 } },
    });
    expect(resolveTarget({ capture: "tcp-lifecycle", mark: "nope" }, markOf).ok).toBe(false);
  });

  it("resolve against the packets area's own captures, not just the contract", () => {
    const missing = targets().flatMap(({ where, target }) => {
      const r = resolveTarget(target, captureMark);
      return r.ok ? [] : [`${where}: ${r.why}`];
    });
    expect(missing).toEqual([]);
  });

  it("use every capture the brief names", () => {
    const used = new Set(
      targets().flatMap(({ target }) => {
        const p = paramsOf(target);
        return [p.capture, p.a, p.b].filter((c) => c !== undefined).map(text);
      }),
    );
    for (const c of Object.keys(CONTRACT)) expect(used.has(c), c).toBe(true);
  });
});

describe("the glossary", () => {
  it("has unique ids and a definition for each term", () => {
    expect(ids.size).toBe(GLOSSARY.length);
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(80);
    for (const g of GLOSSARY) {
      expect(g.def.trim().length, g.id).toBeGreaterThan(20);
      expect(g.id, g.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("links only to terms that exist, and relates only to terms that exist", () => {
    const missing: string[] = [];
    for (const g of GLOSSARY) {
      for (const r of g.related ?? []) if (!ids.has(r)) missing.push(`${g.id} related ${r}`);
      for (const r of termsIn([{ t: "p", v: parseInline(g.def) }]))
        if (!ids.has(r)) missing.push(`${g.id} def ${r}`);
    }
    expect(missing).toEqual([]);
  });

  it("defines the terms the brief names", () => {
    for (const id of [
      "arp",
      "mtu",
      "mss",
      "rtt",
      "cwnd",
      "sack",
      "alpn",
      "sni",
      "ech",
      "cgnat",
      "dfs",
      "snr",
      "bssid",
      "oui",
      "quic",
      "dcid",
      "zero-rtt",
      "hol-blocking",
      "aqm",
      "cake",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
