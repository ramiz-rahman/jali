/** The bundled capture “HTTPS over QUIC: HTTP/3”. */
import {
  ackFrame,
  clientHello,
  cryptoFrame,
  quicInitial,
  quicLongProtected,
  quicShort,
  rng,
  serverHello,
  udp,
  W,
} from "../build";
import { HOSTS, L, Tape, v4, nextId, type Bundled, type Script } from "./tape";

function quicH3Script(): Script {
  const tape = new Tape(2400, "pcap");
  const r = rng(0x9e3);
  const ids = new Map<string, number>();
  const rtt = 25;
  const cport = 58123;
  const odcid = r.bytes(8);
  const ccid = r.bytes(8);
  const scid = r.bytes(8);
  // A packet sealed later (asynchronously) takes its IP ID now, so IDs still count up in send order.
  const up = (payload: Uint8Array, id = nextId(ids, L.ip)) =>
    v4("laptop", L.ip, HOSTS.quic, 17, udp(L.ip, HOSTS.quic, cport, 443, payload), id);
  const down = (payload: Uint8Array, id = nextId(ids, HOSTS.quic)) =>
    v4("internet", HOSTS.quic, L.ip, 17, udp(HOSTS.quic, L.ip, 443, cport, payload), id, 64 - 8);
  const hello = clientHello(r, { sni: "www.example.com", alpn: ["h3"], quic: { scid: ccid } });
  const sh = serverHello(r, { sessionId: new Uint8Array(0), quic: true });
  const id0 = nextId(ids, L.ip);
  tape.add(
    0,
    async () =>
      up(
        await quicInitial({
          ids: { dcid: odcid, scid: ccid },
          keyDcid: odcid,
          side: "client",
          pn: 0,
          frames: cryptoFrame(0, hello),
          padTo: 1200,
        }),
        id0,
      ),
    "client-initial",
  );
  // The server's first datagram: its Initial (ACK, ServerHello) coalesced with the start of its Handshake flight.
  const hs1 = quicLongProtected(r, { dcid: ccid, scid }, 2, 1000);
  const id1 = nextId(ids, HOSTS.quic);
  tape.add(
    rtt + 0.6,
    async () => {
      const initial = await quicInitial({
        ids: { dcid: ccid, scid },
        keyDcid: odcid,
        side: "server",
        pn: 0,
        frames: new W().bytes(ackFrame(0, 12)).bytes(cryptoFrame(0, sh)).out(),
      });
      return down(new W().bytes(initial).bytes(hs1).out(), id1);
    },
    "server-initial",
  );
  tape.add(rtt + 0.7, down(quicLongProtected(r, { dcid: ccid, scid }, 2, 1150)), "handshake");
  // The client ACKs the Initial and finishes the handshake (Handshake: ACK, Finished), then sends its request at once.
  const hsDone = quicLongProtected(r, { dcid: scid, scid: ccid }, 2, 57);
  const id3 = nextId(ids, L.ip);
  tape.add(
    rtt + 1.5,
    async () => {
      const initial = await quicInitial({
        ids: { dcid: scid, scid: ccid },
        keyDcid: odcid,
        side: "client",
        pn: 1,
        frames: ackFrame(0, 1),
        padTo: 1200 - hsDone.length,
      });
      return up(new W().bytes(initial).bytes(hsDone).out(), id3);
    },
    "client-finished",
  );
  tape.add(rtt + 1.6, up(quicShort(r, scid, 0, 92)), "first-1rtt");
  tape.add(2 * rtt + 1.9, down(quicShort(r, ccid, 1, 340)), "handshake-done");
  tape.add(2 * rtt + 3.4, down(quicShort(r, ccid, 1, 1210)), "response");
  tape.add(2 * rtt + 3.5, down(quicShort(r, ccid, 1, 610)));
  tape.add(2 * rtt + 4.2, up(quicShort(r, scid, 1, 31)));
  return tape.script;
}

export const quicH3: Bundled = {
  title: "HTTPS over QUIC: HTTP/3",
  summary:
    "The same page over QUIC. The client's Initial carries the ClientHello, and is decrypted here for real, with keys derived from its Destination Connection ID (RFC 9001). The server answers with Initial and Handshake packets coalesced in one datagram; the client finishes and sends its HTTP/3 request after one round trip, not two. Everything after that is short-header packets nobody on the path can read.",
  build: quicH3Script,
};
