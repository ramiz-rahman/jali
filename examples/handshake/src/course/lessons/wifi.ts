/**
 * Lesson 2: Wi-Fi as a shared radio channel: bands, channels, widths, DFS, signal and noise, airtime. It ends on
 * the reader's own scan, because the sample data is only there to learn to read the picture.
 */
import type { Lesson } from "../types";

export const wifi: Lesson = {
  id: "wifi",
  title: "Wi-Fi: channels, signal and airtime",
  promise:
    "Read a Wi-Fi scan, pick a channel on purpose, and know why “full bars” can still be slow.",
  minutes: 15,
  steps: [
    {
      title: "Three bands, three trade-offs",
      body: [
        "Wi-Fi lives in three [[wifi-band|bands]]. **2.4 GHz** (2400–2483.5 MHz) goes through walls best and is the most crowded: 83.5 MHz of spectrum shared with Bluetooth, Zigbee, baby monitors and microwave ovens. **5 GHz** has about 650 MHz usable in the US, divided into more channels, but is shorter-range. **6 GHz** (5925–7125 MHz in the US: 1200 MHz) is Wi-Fi 6E and 7 only, so no legacy Wi-Fi devices; its incumbents are licensed services such as fixed microwave links, which the power rules protect.",
        "The generation names are marketing for IEEE amendments: Wi-Fi 4 is 802.11n, 5 is 802.11ac (5 GHz only), 6 is 802.11ax, 6E is 802.11ax in the 6 GHz band, 7 is 802.11be.",
        "The scan beside this lesson is **made up**: a crowded 2.4 GHz band, a cleaner 5 GHz, one 6 GHz network. Use it to learn the picture, then load your own at the end.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "2.4 GHz: three lanes, and 1, 6, 11",
      body: [
        "Channels in 2.4 GHz are numbered 1–13 (14 in Japan, 802.11b only), **5 MHz apart**. But a Wi-Fi signal is about 20 MHz wide (22 in the old 802.11b), so channel 3 overlaps 1, 2, 4, 5, 6 and 7. Only channels 1, 6 and 11 are free of one another in the Americas; where channel 13 is legal, 1/5/9/13 is used, with a little overlap.",
        "This is why you should never “spread networks out” across 1–11. Two networks on the *same* channel can decode each other’s headers and politely take turns ([[co-channel]] interference: shared airtime, few collisions). Two on *overlapping* channels hear only noise from each other, defer only when it is loud (energy detection, about −62 dBm), and otherwise talk over each other ([[adjacent-channel]] interference: collisions and retries). Same channel is better than half-overlapping.",
        "Run 20 MHz only in 2.4 GHz. A 40 MHz channel occupies two of the three lanes, and 802.11n’s 20/40 coexistence rules make it fall back to 20 MHz when overlapping networks occupy the channels it would cover, which in a populated 2.4 GHz band is nearly always, so it gains nothing.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "Channel width: speed you pay for twice",
      body: [
        "Peak rate scales with [[channel-width]]: 20, 40, 80, 160 MHz (320 in Wi-Fi 7). The cost has two parts. First, a wide channel collects noise from a wider slice of spectrum: thermal noise rises by **3 dB per doubling** (about −101 dBm in 20 MHz, −95 dBm in 80). Second, the number of non-overlapping channels halves each time.",
        "5 GHz in the US has 25 channels of 20 MHz, which is six 80 MHz channels, but only two 160 MHz channels (a third 80 and 160 where devices support the newer U-NII-4 channels 169–177). A neighbourhood of 80 MHz networks therefore overlaps whether anyone wants it or not, and overlapping wide channels with different primaries cost more than sharing one: a wide channel sends at full width only when every 20 MHz subchannel is idle, and otherwise drops to a narrower slice. For most homes 40 or 80 MHz is the right call; 160 MHz is a benchmark setting.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "5 GHz and DFS: the radar tax",
      body: [
        "5 GHz splits into four groups (UNII-1: 36–48; UNII-2A: 52–64; UNII-2C: 100–144; UNII-3: 149–165). The middle two share spectrum with weather and military radar, so an access point there must run [[dfs]]: listen for 60 seconds before it may transmit (10 minutes on some European weather-radar channels), and if it hears a radar pulse, leave within 10 seconds and stay off for 30 minutes.",
        "That makes DFS channels the *emptiest* ones, because many routers avoid them, and the least predictable: a router set to “auto” may hop channels after a radar hit near an airport, and if it lands on another DFS channel, clients lose the network for the minute it spends listening. If you see mysterious periodic drops, check whether the channel is in the DFS range.",
        "The fixed non-DFS choices are 36–48 and 149–165. 149–165 is where US-only behaviour lives (channel 165 has no 80 MHz block unless the device supports U-NII-4 channels 169–177); outside the US check the local rules.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "6 GHz: room to breathe",
      body: [
        "6 GHz adds 59 channels of 20 MHz in the US: 29 of 40, 14 of 80, 7 of 160. Because it only admits 6E/7 devices, there are no legacy rates, no 2.4-style beacons at 1 Mbit/s and WPA3 (or Enhanced Open) is mandatory, so airtime goes further. The catch is range: higher frequency means more attenuation, so one 6 GHz access point covers less of the house than a 5 GHz one, and power limits apply (low-power indoor, or standard power with automated frequency coordination).",
        "Use it for devices near an access point that you want fast and uncontended: a laptop at a desk, a headset. The sample scan has one 6 GHz network, which is what most neighbourhoods look like today: an empty band is a feature.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "dBm, signal and noise",
      body: [
        "Signal strength is in [[dbm]]: decibels relative to 1 mW. It is logarithmic: **+3 dB doubles the power, +10 dB is ten times**. Typical readings: −30 dBm is standing next to the access point, −50 is excellent, −67 is the usual minimum for reliable video and calls, −70 is “works”, −80 is barely connected, −90 is gone. The number your OS reports is [[rssi]], a vendor-scaled measure of how loud the AP is.",
        "What actually decides your speed is the [[snr]]: signal minus the [[noise-floor]]. With signal −60 dBm and noise −95 dBm, SNR is 35 dB: fast. In a crowded apartment block the floor rises to −85 and the same −60 signal has only 25 dB. Rough thresholds: 30–35 dB or more for the top [[mcs|modulations]] (1024-QAM; Wi-Fi 7’s 4096-QAM needs more), 15–25 dB for good rates, under 10 dB only the slowest, most robust modulation.",
        "A strong signal on a noisy channel is worse than a moderate signal on a clean one. This is why a 6 GHz network at −65 dBm can beat a 2.4 GHz network at −45.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "Airtime: the one resource",
      body: [
        "Wi-Fi is half duplex and listen-before-talk (CSMA/CA): on a channel, one device wins the air at a time (Wi-Fi 6’s OFDMA lets the access point schedule several clients inside that turn), and every device within hearing range waits. The real resource is [[airtime]], not bandwidth. Sending a 1500-byte frame at the slowest rate takes far longer than at the fastest, so one distant phone at a low [[mcs|rate]] can hold the channel for ten times as long as a laptop next to the router to move the same bytes (the “performance anomaly”, documented in 2003 and still true).",
        "Overhead also costs airtime: every SSID the access point broadcasts sends a beacon about ten times a second (every 102.4 ms), at the lowest basic rate. Five SSIDs on 2.4 GHz with a 1 Mbit/s basic rate can burn a tenth of the channel doing nothing. Turn off the ones you do not need, and the old low rates.",
        "Neighbours’ networks on the same channel count too. Airtime used by a stranger’s video stream is airtime you do not have, even though you cannot read a byte of it.",
      ],
      show: { kind: "wifi", params: { scan: "sample-wifi" } },
    },
    {
      title: "Why more bars is not faster",
      body: [
        "Bars come from [[rssi]] alone, mapped to a scale each vendor made up. They say nothing about the noise floor, how busy the channel is, which band you are on, the width you negotiated, or how fast the access point’s own uplink is. A link can be five bars at −40 dBm on a 2.4 GHz channel with ten neighbours and crawl, while three bars on a clean 6 GHz channel flies.",
        "What to look at instead: SNR (not just signal), channel utilisation, whether your channel overlaps others, and the rate (MCS and width) your device actually negotiated. Your OS shows the last in a hidden menu (macOS: hold Option and click the Wi-Fi icon; it prints RSSI, noise, channel and TX rate).",
      ],
      tryIt: {
        text: "Now load yours. Open Scans for the one command that lists nearby networks on your OS, paste its output, and the Wi-Fi pane will show your channels, widths and crowding. Look for your own network and count who shares its channel.",
        open: { kind: "scans", params: {} },
      },
    },
  ],
  check: [
    {
      q: "You see networks on 2.4 GHz channels 1, 4, 8 and 11. Which pairs interfere destructively, and what would you move?",
      a: [
        "1 and 4 overlap (3 channels apart is only 15 MHz for a 20–22 MHz signal), and 8 overlaps 11 for the same reason; 4 and 8 overlap partly too. Moving to a clean 1, 6 or 11 makes interference co-channel (shared airtime) rather than adjacent-channel (corruption), which is the lesser evil.",
      ],
    },
    {
      q: "Signal is −58 dBm and noise is −92 dBm. What is the SNR, and what happens to it if you double the channel width?",
      a: [
        "SNR = −58 − (−92) = **34 dB**. Doubling the width raises the noise floor by about 3 dB, so at the same transmit power SNR drops to roughly 31 dB: still plenty, but a marginal link loses a modulation step.",
      ],
    },
    {
      q: "Why does the DFS range help and hurt at once?",
      a: [
        "Fewer networks use it, so it is quieter. But the access point must stay off the channel for 60 s before use, and must vacate within 10 s of detecting radar, so it can drop clients without warning.",
      ],
    },
  ],
};
