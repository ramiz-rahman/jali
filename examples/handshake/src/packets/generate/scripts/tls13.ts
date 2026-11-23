/** The bundled capture “HTTPS: TCP, then TLS 1.3”. */
import { clientHello, encryptedRecord, rng, serverHello, TCPF, tlsRecord, W } from "../build";
import { HOSTS, L, Tape, Tcp, type Bundled, type Script } from "./tape";

function tls13Script(): Script {
  const tape = new Tape(1800, "pcap");
  const r = rng(0x713);
  const rtt = 25;
  const c = new Tcp(tape, r, { ip: L.ip, port: 53220 }, { ip: HOSTS.tls, port: 443 }, 9);
  c.handshake(0, rtt);
  const hello = clientHello(r, { sni: "www.example.com", alpn: ["h2", "http/1.1"] });
  // The ClientHello's legacy session ID, which the server echoes.
  const sid = hello.subarray(4 + 2 + 32 + 1, 4 + 2 + 32 + 1 + 32);
  c.send(0, rtt + 0.4, TCPF.ACK | TCPF.PSH, tlsRecord(22, hello, 0x0301), { mark: "client-hello" });
  c.send(1, 2 * rtt + 0.4, TCPF.ACK);
  const t = 2 * rtt + 1.2;
  c.send(1, t, TCPF.ACK, tlsRecord(22, serverHello(r, { sessionId: sid })), {
    mark: "server-hello",
  });
  c.send(1, t + 0.05, TCPF.ACK, tlsRecord(20, Uint8Array.of(1)), { mark: "change-cipher-spec" });
  // EncryptedExtensions, Certificate, CertificateVerify and Finished: one 2,904-byte record split over two segments.
  const flight = encryptedRecord(r, 2899);
  c.send(1, t + 0.1, TCPF.ACK, flight.subarray(0, 1448), { mark: "first-encrypted" });
  c.send(1, t + 0.15, TCPF.ACK | TCPF.PSH, flight.subarray(1448));
  c.send(0, t + 0.3, TCPF.ACK);
  // The client's CCS (for middleboxes) and its encrypted Finished, then the HTTP/2 request at once.
  const fin = new W()
    .bytes(tlsRecord(20, Uint8Array.of(1)))
    .bytes(encryptedRecord(r, 53))
    .out();
  c.send(0, t + 1.6, TCPF.ACK | TCPF.PSH, fin, { mark: "client-finished" });
  c.send(0, t + 1.8, TCPF.ACK | TCPF.PSH, encryptedRecord(r, 214), { mark: "request" });
  c.send(1, t + rtt + 1.7, TCPF.ACK);
  c.send(
    1,
    t + rtt + 2.1,
    TCPF.ACK | TCPF.PSH,
    new W().bytes(encryptedRecord(r, 250)).bytes(encryptedRecord(r, 250)).out(),
    { mark: "session-tickets" },
  );
  c.send(1, t + rtt + 6.0, TCPF.ACK | TCPF.PSH, encryptedRecord(r, 1219), { mark: "response" });
  c.send(0, t + rtt + 6.2, TCPF.ACK);
  // close_notify, encrypted like everything else, then both FINs.
  c.send(0, t + rtt + 40.0, TCPF.ACK | TCPF.PSH, encryptedRecord(r, 19), { mark: "close-notify" });
  c.send(0, t + rtt + 40.1, TCPF.FIN | TCPF.ACK, undefined, { mark: "fin" });
  c.send(1, t + 2 * rtt + 40.4, TCPF.FIN | TCPF.ACK);
  c.send(0, t + 2 * rtt + 40.5, TCPF.ACK, undefined, { mark: "last-ack" });
  return tape.script;
}

export const tls13: Bundled = {
  title: "HTTPS: TCP, then TLS 1.3",
  summary:
    "A TCP handshake, then TLS 1.3 to www.example.com: a ClientHello with SNI, ALPN and X25519MLKEM768 offered, a ServerHello choosing X25519, a ChangeCipherSpec only for middleboxes, and from there everything encrypted, the certificate included. The HTTP/2 request leaves after two round trips: one for TCP, one for TLS.",
  build: tls13Script,
};
