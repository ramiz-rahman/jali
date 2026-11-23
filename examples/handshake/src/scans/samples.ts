/**
 * The sample scans: made-up outputs in the exact formats the real tools print, so they go through the same parsers
 * as a scan of your own network. Networks, names, addresses and latencies are invented; the MAC prefixes are real
 * vendor prefixes so the vendor lookup has something to find. Public hops use documentation addresses
 * (RFC 5737) so no real network is described.
 */

interface SampleNetwork {
  name: string;
  channel: string;
  phy: string;
  security: string;
  signal: number;
  noise: number;
  rate?: number;
}

const net = (
  name: string,
  channel: string,
  phy: string,
  security: string,
  signal: number,
  noise = -93,
  rate?: number,
): SampleNetwork => ({ name, channel, phy, security, signal, noise, rate });

const entry = (n: SampleNetwork) => ({
  _name: n.name,
  spairport_network_channel: n.channel,
  spairport_network_phymode: n.phy,
  spairport_security_mode: n.security,
  spairport_signal_noise: `${n.signal} dBm / ${n.noise} dBm`,
  ...(n.rate ? { spairport_network_rate: n.rate } : {}),
});

const WPA2 = "spairport_security_mode_wpa2_personal";
const WPA3 = "spairport_security_mode_wpa3_personal";

/** A crowded 2.4 GHz band, a cleaner 5 GHz with overlapping 80 MHz blocks, and one 6 GHz network. */
export const SAMPLE_WIFI = JSON.stringify(
  {
    SPAirPortDataType: [
      {
        spairport_airport_interfaces: [
          {
            _name: "en0",
            spairport_current_network_information: entry(
              net("Home-5G", "149 (5GHz, 80MHz)", "802.11ax", WPA3, -47, -92, 1201),
            ),
            spairport_airport_other_local_wireless_networks: [
              net("Corner Cafe Guest", "1 (2GHz, 20MHz)", "802.11n", WPA2, -58),
              net("Nimbus-7A3C", "1 (2GHz, 20MHz)", "802.11n", WPA2, -64),
              net("SKY-4F29", "6 (2GHz, 20MHz)", "802.11n", WPA2, -52),
              net("TALKTALK-9B21", "6 (2GHz, 20MHz)", "802.11n", WPA2, -71),
              net("Flat4B", "6 (2GHz, 20MHz)", "802.11n", WPA2, -66),
              net("VM3302911", "11 (2GHz, 20MHz)", "802.11n", WPA2, -62),
              net("DIRECT-roku-3A", "11 (2GHz, 20MHz)", "802.11n", WPA2, -78),
              net("Hallway TV", "3 (2GHz, 20MHz)", "802.11n", WPA2, -74),
              net("Nimbus-5G-7A3C", "36 (5GHz, 80MHz)", "802.11ac", WPA2, -60),
              net("SKY-4F29-5", "44 (5GHz, 80MHz)", "802.11ax", WPA2, -68),
              net("Flat4B-5G", "100 (5GHz, 80MHz)", "802.11ac", WPA2, -71),
              net("Upstairs-5G", "149 (5GHz, 80MHz)", "802.11ax", WPA3, -63),
              net("Studio-AP", "157 (5GHz, 80MHz)", "802.11ax", WPA2, -72),
              net("Neighbour-40", "52 (5GHz, 40MHz)", "802.11n", WPA2, -77),
              net("Studio-6G", "37 (6GHz, 80MHz)", "802.11ax", WPA3, -69),
            ].map(entry),
          },
        ],
      },
    ],
  },
  null,
  2,
);

/** `arp -a` on macOS, which drops leading zeros in every MAC octet. */
export const SAMPLE_DEVICES = `router.lan (192.168.1.1) at 0:a:eb:3c:11:2f on en0 ifscope [ethernet]
? (192.168.1.12) at a6:83:e7:12:9c:44 on en0 ifscope [ethernet]
? (192.168.1.14) at 3a:5c:11:ab:7:de on en0 ifscope [ethernet]
macbook.lan (192.168.1.20) at 0:3:93:2a:b1:7c on en0 ifscope [ethernet]
? (192.168.1.23) at 0:7:ab:1f:e0:92 on en0 ifscope [ethernet]
ps5.lan (192.168.1.31) at 0:a:d9:4c:6e:1 on en0 ifscope [ethernet]
BRN001BA95D206C.lan (192.168.1.40) at 0:1b:a9:5d:20:6c on en0 ifscope [ethernet]
? (192.168.1.51) at 4:83:8:e1:5:c2 on en0 ifscope [ethernet]
? (192.168.1.52) at 10:d5:61:7c:3:9a on en0 ifscope [ethernet]
sonos-living-room.lan (192.168.1.60) at 0:e:58:b2:44:90 on en0 ifscope [ethernet]
? (192.168.1.77) at (incomplete) on en0 ifscope [ethernet]
? (192.168.1.255) at ff:ff:ff:ff:ff:ff on en0 ifscope [ethernet]
? (224.0.0.251) at 1:0:5e:0:0:fb on en0 ifscope permanent [ethernet]
? (239.255.255.250) at 1:0:5e:7f:ff:fa on en0 ifscope permanent [ethernet]
`;

/** macOS `traceroute`: a home router, CGNAT, a hop that never answers, a latency jump, and the destination. */
export const SAMPLE_PATH = `traceroute to one.one.one.one (1.1.1.1), 64 hops max, 40 byte packets
 1  192.168.1.1 (192.168.1.1)  2.104 ms  1.873 ms  2.310 ms
 2  100.64.0.1 (100.64.0.1)  9.812 ms  9.447 ms  10.203 ms
 3  * * *
 4  203.0.113.17 (203.0.113.17)  31.418 ms  28.907 ms  33.021 ms
 5  203.0.113.18 (203.0.113.18)  11.902 ms *  12.388 ms
 6  ae-3.core1.example-isp.net (198.51.100.9)  48.612 ms  47.905 ms  49.113 ms
 7  198.51.100.62 (198.51.100.62)  49.307 ms  49.720 ms  48.995 ms
 8  one.one.one.one (1.1.1.1)  49.801 ms  50.014 ms  49.617 ms
`;
