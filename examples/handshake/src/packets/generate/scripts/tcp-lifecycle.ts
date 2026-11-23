/** The bundled capture “A TCP connection, start to finish”. */
import { rng, TCPF } from "../build";
import { HOSTS, L, Tape, Tcp, text, type Bundled, type Script } from "./tape";

function tcpLifecycleScript(): Script {
  const tape = new Tape(1200, "pcap");
  const r = rng(0x7c9);
  const rtt = 25;
  const c = new Tcp(tape, r, { ip: L.ip, port: 53214 }, { ip: HOSTS.web, port: 80 }, 11);
  c.handshake(0, rtt);
  const request = text(
    "GET /reports/rtt-2026-11.csv HTTP/1.1\r\nHost: files.example.org\r\nUser-Agent: curl/8.11.1\r\nAccept: */*\r\n\r\n",
  );
  c.send(0, rtt + 0.3, TCPF.ACK | TCPF.PSH, request, { mark: "request" });
  c.send(1, 2 * rtt + 0.5, TCPF.ACK);

  // The response: 7 segments of up to 1448 bytes (MSS 1460 minus the 12-byte timestamp option).
  const mss = 1448;
  const total = mss * 6 + 1100;
  // Content-Length counts the body, whose size depends on the header's own length: two passes settle it.
  let head = "";
  for (let pass = 0; pass < 2; pass++) {
    const len = total - head.length;
    head = [
      "HTTP/1.1 200 OK",
      "Date: Mon, 23 Nov 2026 09:00:01 GMT",
      "Server: nginx/1.26.2",
      "Content-Type: text/csv; charset=utf-8",
      `Content-Length: ${len}`,
      "Last-Modified: Sun, 22 Nov 2026 23:59:58 GMT",
      'ETag: "6741c3ee-2a1f"',
      "Cache-Control: max-age=300",
      "Connection: keep-alive",
      "",
      "",
    ].join("\r\n");
  }
  const rows = ["time,target,rtt_ms,loss_pct"];
  for (let i = 0; rows.join("\n").length < total; i++) {
    rows.push(
      `2026-11-22T${String(Math.floor(i / 60) % 24).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z,198.51.100.10,${(24 + r.next() * 3).toFixed(2)},${r.int(40) === 0 ? "0.5" : "0.0"}`,
    );
  }
  const body = text(head + rows.join("\n")).subarray(0, total);
  const seg = (k: number) => body.subarray(k * mss, Math.min(total, (k + 1) * mss));
  const t = 2 * rtt + 2;
  c.send(1, t, TCPF.ACK, seg(0), { mark: "response-first" });
  c.send(1, t + 0.1, TCPF.ACK, seg(1));
  c.send(0, t + 0.2, TCPF.ACK);
  // Segment 3 is lost on the way: it never reaches the laptop, so it isn't in the capture.
  const lostSeq = c.raw(1);
  c.send(1, t + 0.3, TCPF.ACK, seg(2), { record: false });
  const sackStart = c.raw(1);
  c.send(1, t + 0.4, TCPF.ACK, seg(3));
  // The laptop's ACKs stay at the hole; SACK says what did arrive past it.
  // Every ACK in the recovery acknowledges up to the hole, not past it.
  const dup = (ms: number, mark?: string) =>
    c.send(0, ms, TCPF.ACK, undefined, {
      mark,
      ack: lostSeq,
      opts: [
        ...c.timestamps(0, ms),
        { nop: true },
        { nop: true },
        { sack: [[sackStart, c.raw(1)]] },
      ],
    });
  dup(t + 0.5, "dup-ack");
  c.send(1, t + 0.6, TCPF.ACK, seg(4));
  dup(t + 0.7);
  c.send(1, t + 0.8, TCPF.ACK, seg(5));
  dup(t + 0.9);
  // Three duplicate ACKs reach the server half an RTT later; its fast retransmit arrives half an RTT after that.
  c.send(1, t + 0.9 + rtt, TCPF.ACK, seg(2), { mark: "retransmission", seq: lostSeq });
  c.send(0, t + rtt + 1.0, TCPF.ACK);
  c.send(1, t + rtt + 1.2, TCPF.ACK | TCPF.PSH, seg(6));
  // The receive buffer fills while curl writes the file: a smaller window, then the update once it has read it.
  c.send(0, t + rtt + 1.3, TCPF.ACK, undefined, { win: 1371 });
  c.send(0, t + rtt + 6.8, TCPF.ACK, undefined, { win: 2052, mark: "window-update" });
  // curl is done and closes; the server closes its side in reply.
  c.send(0, t + rtt + 7.5, TCPF.FIN | TCPF.ACK, undefined, { mark: "fin" });
  c.send(1, t + 2 * rtt + 7.9, TCPF.FIN | TCPF.ACK);
  c.send(0, t + 2 * rtt + 8.0, TCPF.ACK, undefined, { mark: "last-ack" });
  return tape.script;
}

export const tcpLifecycle: Bundled = {
  title: "A TCP connection, start to finish",
  summary:
    "curl fetches a CSV over plain HTTP/1.1. The three-way handshake sets MSS, window scaling, SACK and timestamps; the response comes in seven segments, and one is lost before it reaches the laptop. Three duplicate ACKs with SACK blocks point at the hole, the server's fast retransmission fills it one round trip later, a window update follows once curl has read its buffer, and both sides close with FIN.",
  build: tcpLifecycleScript,
};
