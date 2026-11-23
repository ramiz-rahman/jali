/** Recorded public-source response shapes, reduced to relevant fields; all tests are offline. */
import {
  certificateWindow,
  addresses,
  normalizeDomain,
  parseCertificates,
  parseDns,
  parseHttps,
  parseNetwork,
  parseRdap,
  sameDns,
  subdomains,
} from "./probe-model";

const CF_HTTPS =
  '{"Status":0,"TC":false,"RD":true,"RA":true,"AD":true,"CD":false,"Question":[{"name":"cloudflare.com","type":65}],"Answer":[{"name":"cloudflare.com","type":65,"TTL":300,"data":"1 . alpn=h3,h2 ipv4hint=104.16.132.229,104.16.133.229 ipv6hint=2606:4700::6810:84e5,2606:4700::6810:85e5"}]}';
const GOOGLE_HTTPS =
  '{"Status":0,"AD":true,"Answer":[{"name":"cloudflare.com.","type":65,"TTL":300,"data":"1 . alpn=h3,h2 ipv4hint=104.16.132.229,104.16.133.229 ipv6hint=2606:4700::6810:84e5,2606:4700::6810:85e5"},{"name":"cloudflare.com.","type":46,"TTL":300,"data":"https 13 2 300 1795478861 1795298861 34505 cloudflare.com. signature"}]}';
const RDAP =
  '{"objectClassName":"domain","ldhName":"EXAMPLE.COM","status":["client delete prohibited","client transfer prohibited"],"entities":[{"handle":"376","roles":["registrar"],"vcardArray":["vcard",[["version",{},"text","4.0"],["fn",{},"text","RESERVED-Internet Assigned Numbers Authority"]]]}],"events":[{"eventAction":"registration","eventDate":"1995-08-14T04:00:00Z"},{"eventAction":"expiration","eventDate":"2027-08-13T04:00:00Z"}],"nameservers":[{"ldhName":"ELLIOTT.NS.CLOUDFLARE.COM"},{"ldhName":"HERA.NS.CLOUDFLARE.COM"}]}';
const RIPE =
  '{"status":"ok","data":{"is_less_specific":true,"announced":true,"asns":[{"asn":13335,"holder":"CLOUDFLARENET - Cloudflare, Inc."}],"resource":"1.1.1.0/24","type":"prefix","query_time":"2026-11-22T16:00:00"}}';
const CERTS =
  '[{"id":"12937142056","dns_names":["example.com","example.edu","www.example.com","www.example.edu"],"issuer":{"friendly_name":"Sectigo","name":"C=GB, O=Sectigo Limited, CN=Sectigo Public Server Authentication CA OV R36"},"not_before":"2025-12-02T00:00:00Z","not_after":"2026-12-02T23:59:59Z","revoked":false},{"id":"17232708246","dns_names":["*.example.com","example.com","www.example.com"],"issuer":{"friendly_name":"Sectigo"},"not_before":"2026-09-17T00:00:00Z","not_after":"2026-12-13T21:47:42Z","revoked":null}]';

describe("domain normalization", () => {
  it("uses URL's IDNA conversion and canonicalizes case and a final dot", () => {
    expect(normalizeDomain(" BÜCHER.example. ")).toBe("xn--bcher-kva.example");
    expect(normalizeDomain("Cloudflare.COM")).toBe("cloudflare.com");
  });
  it.each([
    "",
    "localhost",
    "https://example.com",
    "example.com/path",
    "example.com:443",
    "user@example.com",
    "*.example.com",
    "127.0.0.1",
    "2130706433",
    "example..com",
    "-a.example",
    "a_.example",
    "example.com?x",
    "a%2eb.com",
    "[::1]",
  ])("rejects %j", (input) => {
    expect(() => normalizeDomain(input)).toThrow();
  });
});

describe("DNS and HTTPS", () => {
  it("decodes TTL/AD and compares answers without order, trailing owner dot or DNSSEC signatures", () => {
    const cf = parseDns(CF_HTTPS);
    const google = parseDns(GOOGLE_HTTPS);
    expect(cf.ad).toBe(true);
    expect(cf.answers[0]?.ttl).toBe(300);
    expect(sameDns(cf, google)).toBe(true);
    expect(sameDns(cf, { ...google, ad: false })).toBe(false);
    expect(sameDns(cf, parseDns(GOOGLE_HTTPS.replace('"TTL":300', '"TTL":299')))).toBe(false);
  });
  it("keeps NXDOMAIN and NODATA distinct from a transport failure", () => {
    expect(parseDns('{"Status":3,"AD":true,"Authority":[]}')).toEqual({
      status: 3,
      ad: true,
      answers: [],
      authority: [],
    });
    expect(parseDns('{"Status":0}').answers).toEqual([]);
    expect(() => parseDns('{"error":"bad gateway"}')).toThrow();
    expect(parseDns('{"Status":0,"Answer":[null,{"data":1}]}').answers).toEqual([]);
  });
  it("decodes HTTPS ALPN, hints and ECH without claiming a negotiated protocol", () => {
    const raw = parseDns(CF_HTTPS).answers[0]?.data ?? "";
    expect(parseHttps(raw)).toMatchObject({
      alpn: ["h3", "h2"],
      ipv4: ["104.16.132.229", "104.16.133.229"],
      ech: false,
      decoded: true,
    });
    expect(parseHttps('1 . alpn="h3,h2" ech="AA=="').ech).toBe(true);
    expect(parseHttps("0 alias.example.").alpn).toEqual([]);
    expect(parseHttps("bad data").decoded).toBe(false);
  });
  it("reads RFC 3597 generic HTTPS RDATA and rejects truncated data", () => {
    expect(parseHttps("\\# 13 00010000010006026833026832")).toMatchObject({
      alpn: ["h3", "h2"],
      decoded: true,
    });
    expect(parseHttps("\\# 11 0001000005000401020304")).toMatchObject({ ech: true, decoded: true });
    expect(parseHttps("\\# 13 00010000010006026833").decoded).toBe(false);
  });
  it("collects and deduplicates addresses from both resolvers including CNAME chains", () => {
    const a = parseDns(
      '{"Status":0,"Answer":[{"name":"a.example","TTL":60,"type":5,"data":"b.example."},{"name":"b.example","TTL":60,"type":1,"data":"1.1.1.1"},{"name":"b.example","TTL":60,"type":28,"data":"2606:4700:4700::1111"}]}',
    );
    expect(addresses([a, a])).toEqual(["1.1.1.1", "2606:4700:4700::1111"]);
  });
});

describe("ownership and certificate sources", () => {
  it("distinguishes future, current and expired certificate date windows", () => {
    const cert = { before: "2026-01-01T00:00:00Z", after: "2027-01-01T00:00:00Z" };
    expect(certificateWindow(cert, Date.parse("2025-12-01"))).toBe("not-yet");
    expect(certificateWindow(cert, Date.parse("2026-06-01"))).toBe("valid");
    expect(certificateWindow(cert, Date.parse("2027-06-01"))).toBe("expired");
  });
  it("extracts registrar vCard, registration events, statuses and nameservers", () => {
    expect(parseRdap(RDAP)).toMatchObject({
      domain: "EXAMPLE.COM",
      registrar: "RESERVED-Internet Assigned Numbers Authority",
      created: "1995-08-14T04:00:00Z",
      expires: "2027-08-13T04:00:00Z",
      nameservers: ["ELLIOTT.NS.CLOUDFLARE.COM", "HERA.NS.CLOUDFLARE.COM"],
    });
    expect(parseRdap('{"objectClassName":"domain"}').registrar).toBeUndefined();
    expect(() => parseRdap('{"errorCode":404}')).toThrow();
  });
  it("retains prefix origin ASN and handles an unannounced address", () => {
    expect(parseNetwork(RIPE)).toMatchObject({
      prefix: "1.1.1.0/24",
      announced: true,
      asns: [{ asn: 13335, holder: "CLOUDFLARENET - Cloudflare, Inc." }],
    });
    expect(
      parseNetwork('{"data":{"resource":"192.0.2.0/24","announced":false,"asns":[]}}').asns,
    ).toEqual([]);
    expect(() => parseNetwork('{"status":"error"}')).toThrow();
  });
  it("keeps certificate dates and SAN patterns, deduplicating only true domain descendants", () => {
    const certs = parseCertificates(CERTS);
    expect(certs).toHaveLength(2);
    expect(certs[0]?.issuer).toContain("Sectigo Public Server");
    expect(certs[1]?.revoked).toBeUndefined();
    expect(subdomains(certs, "example.com")).toEqual(["*.example.com", "www.example.com"]);
    expect(() => parseCertificates('{"code":"rate_limited"}')).toThrow();
    expect(parseCertificates("[]")).toEqual([]);
  });
});
