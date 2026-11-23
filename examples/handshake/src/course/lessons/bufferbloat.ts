/**
 * Lesson 6: latency under load. Builds on TCP's congestion control: a loss-based sender fills whatever buffer sits
 * at the bottleneck, and what a speed test reports hides it. Ends with the fix and how to read a result.
 */
import type { Lesson } from "../types";

export const bufferbloat: Lesson = {
  id: "bufferbloat",
  title: "Bufferbloat: why a fast connection lags",
  promise:
    "Explain why calls stutter during an upload, measure it, and know what actually fixes it.",
  minutes: 12,
  steps: [
    {
      title: "Speed is not the only number",
      body: [
        "A speed test reports **throughput**: bits per second at saturation. What your calls, games and page loads feel is **latency**, and in particular latency *while someone else is using the link*. A connection can score 500 Mbit/s and add two seconds of delay whenever a backup runs.",
        "The two have almost nothing to do with each other, which is why bandwidth upgrades so often fail to fix “the Internet is slow”. The condition has a name, coined by Jim Gettys in 2010: [[bufferbloat]].",
      ],
      show: { kind: "connection", params: {} },
    },
    {
      title: "Where the queue forms",
      body: [
        "Every path has a **bottleneck**: the slowest link, usually the one between your home and the ISP. Packets arrive at it faster than it can send them, and wait in a buffer. A buffer is useful: it absorbs bursts. A huge buffer is poison, because the delay a packet suffers is just how much sits ahead of it:",
        "```\nqueue delay = bytes queued ÷ link rate\n256 KB ÷ 10 Mbit/s = 262,144 × 8 ÷ 10,000,000 ≈ 210 ms\n```",
        "Memory got cheap and nobody was paid to keep queues short, so modems and routers shipped with buffers sized for the fastest speed they might ever see, then ran on slow uplinks. Cable modems with a second of buffering were common. Your 20 ms path becomes a 1.2 s path as soon as the buffer fills.",
      ],
    },
    {
      title: "Why the buffer fills: congestion control",
      body: [
        "Recall from the TCP lesson what a [[cubic|CUBIC]] or Reno sender does: it grows its window until it sees loss, and only then backs off. The only way a loss-based sender finds the limit is to fill the buffer until it overflows. With a deep buffer that takes a long time, and every packet queued behind that standing backlog pays for it, including the DNS query, the call’s UDP packets, the ACKs for your downloads.",
        "The pernicious detail is that the queue is *standing*: after each loss the sender backs off only part way (CUBIC to 70%), which in a deep buffer leaves most of the queue in place. Latency does not spike and recover; it sits near the maximum for the length of the transfer.",
        "[[bbr|BBR]] was designed partly to avoid this (it aims for about one [[bdp]] in flight rather than a full buffer), but your uploads use your computer’s algorithm and your downloads use the server’s, and the buffer is in between either way.",
      ],
    },
    {
      title: "Why speed tests lie, and what to measure",
      body: [
        "A classic speed test measures throughput and, separately, an idle ping. It never asks the question that matters: what is the latency *during* the transfer? The result is a number that makes the ISP look good and tells you nothing about call quality.",
        "Measure **working latency**: [[rtt]] while the link is saturated, in each direction, and how far it rises above the idle RTT. The tools that do: Waveform’s bufferbloat test and Cloudflare’s speed test (both report loaded latency), `flent`’s RRUL test for a proper lab, and macOS’s `networkQuality` command, which reports **RPM** (round trips per minute: 60,000 ÷ RTT in ms, so 100 ms is 600 RPM) alongside throughput.",
        "This app’s connection pane measures what a browser can see: latency before and during a transfer to Cloudflare.",
      ],
      show: { kind: "connection", params: {} },
      tryIt: {
        text: "Run the connection test twice: once with the network otherwise idle, once while something else is uploading (a cloud backup, a video call). The difference in latency between idle and loaded is your latency under load; on a wired link, nearly all of it is bufferbloat.",
        open: { kind: "connection", params: {} },
      },
    },
    {
      title: "Reading the result",
      body: [
        "Look at the **increase** from idle to loaded, not the absolute number. A rough scale: under about 30 ms of extra delay is excellent; 30–100 ms is noticeable in games and calls; more than 100 ms is a real problem; hundreds of ms or seconds is severe bufferbloat. For voice, ITU-T G.114 puts the budget for one-way delay at 150 ms *total*, and a 200 ms queue spends it all.",
        "Check the direction. **Upload** bloat is the common one: the uplink is slow, so the queue in the modem is long. **Download** bloat happens in the ISP’s equipment, where you cannot change the buffer, but you *can* make your own router the bottleneck instead (next step).",
        "And check jitter, the variation in latency. Standing queues are steady; competing flows make them vary, which is what makes a call stutter even when the average looks fine.",
      ],
      show: { kind: "connection", params: {} },
    },
    {
      title: "The fix: make the queue smart, and make it yours",
      body: [
        "Two ideas, both from the router. First, [[aqm|active queue management]]: a queue that drops or marks packets *early*, on purpose, so senders slow down while the buffer is still short. **CoDel** (RFC 8289) watches how long packets actually sit and starts dropping when the minimum delay stays above 5 ms for 100 ms. **PIE** is the variant DOCSIS 3.1 modems mandate.",
        "Second, **flow queueing**: separate queues per flow, served round-robin, so a bulk upload cannot stand in front of a DNS query or a call. [[fq-codel|fq_codel]] (RFC 8290) does both, and is the default on much of Linux. [[cake|CAKE]] adds a shaper, per-host fairness and overhead compensation for the link type, and is the standard recommendation for home routers (OpenWrt’s SQM, many modern routers).",
        "The trick that makes this work for downloads too: set the shaper to about **85–95% of your measured line rate**. The bottleneck then moves to your router’s smart queue; for downloads this works indirectly (your router drops or marks, senders slow down, and the ISP’s buffer stays mostly empty). You give up a few percent of the top speed and gain a connection that stays responsive under load. [[ecn|ECN]] lets a router signal congestion without dropping anything, where both ends support it.",
      ],
    },
    {
      title: "What to do about it",
      body: [
        "- Measure first: idle versus loaded, both directions.\n- If your router offers SQM, CAKE or “smart queue”, turn it on with the bandwidth set to 90% of a clean speed test, and measure again.\n- If it does not, an upgrade to a router that does is the single most useful network purchase for a household that calls and games.\n- Where the ISP’s equipment is the bloated part and you cannot shape (many cable and fixed-wireless cases), bufferbloat is a real argument for asking for a different plan or a bridged modem.\n- It is not fixed by more bandwidth. Faster links drain the same buffer sooner, but it still fills.",
      ],
    },
  ],
  check: [
    {
      q: "A modem has a 512 KB upstream buffer and a 20 Mbit/s uplink. How much latency can a full buffer add?",
      a: ["524,288 × 8 ÷ 20,000,000 ≈ **210 ms**. Halve the uplink rate and it doubles."],
    },
    {
      q: "Why does a loss-based congestion controller create the problem, and why does the delay not come and go?",
      a: [
        "It only learns the bottleneck’s capacity when the buffer overflows and drops a packet, so it keeps the buffer full. Each loss trims the window only part way, so while a bulk flow keeps running the queue never fully drains: a standing queue, a near-constant added delay.",
      ],
    },
    {
      q: "Why set the shaper to 90% of the line rate rather than 100%?",
      a: [
        "So the queue forms in your router, whose AQM keeps it short, instead of in the ISP’s buffer, which you cannot control. At 100% the two bottlenecks are equal and the ISP’s buffer can still fill.",
      ],
    },
  ],
};
