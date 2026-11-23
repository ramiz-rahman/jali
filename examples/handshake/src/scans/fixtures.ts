/**
 * Recorded-style outputs of each tool, as the tool prints them (headers, padding, blank lines and each platform's
 * quirks included), for the parser tests. Network names and addresses are invented.
 */

/** macOS 26 without Location permission: every name is `<redacted>`; one network has no signal figure. */
export const MACOS_JSON_REDACTED = `{
  "SPAirPortDataType" : [
    {
      "spairport_airport_interfaces" : [
        {
          "_name" : "en0",
          "spairport_card_type" : "spairport_wireless_card_type_wifi (0x14E4, 0x4387)",
          "spairport_current_network_information" : {
            "_name" : "<redacted>",
            "spairport_network_channel" : "149 (5GHz, 80MHz)",
            "spairport_network_country_code" : "GB",
            "spairport_network_mcs" : 9,
            "spairport_network_phymode" : "802.11ax",
            "spairport_network_rate" : 866,
            "spairport_network_type" : "spairport_network_type_station",
            "spairport_security_mode" : "spairport_security_mode_wpa3_personal",
            "spairport_signal_noise" : "-52 dBm / -92 dBm"
          },
          "spairport_airport_other_local_wireless_networks" : [
            {
              "_name" : "<redacted>",
              "spairport_network_channel" : "6 (2GHz, 20MHz)",
              "spairport_network_phymode" : "802.11n",
              "spairport_security_mode" : "spairport_security_mode_wpa2_personal",
              "spairport_signal_noise" : "-71 dBm / -93 dBm"
            },
            {
              "_name" : "<redacted>",
              "spairport_network_channel" : "36 (5GHz, 40MHz)",
              "spairport_network_phymode" : "802.11ac",
              "spairport_security_mode" : "spairport_security_mode_none"
            },
            {
              "_name" : "<redacted>",
              "spairport_network_channel" : "37 (6GHz, 160MHz)",
              "spairport_network_phymode" : "802.11ax",
              "spairport_security_mode" : "spairport_security_mode_wpa3_personal",
              "spairport_signal_noise" : "-66 dBm / -95 dBm"
            }
          ],
          "spairport_status_information" : "spairport_status_connected"
        },
        {
          "_name" : "awdl0",
          "spairport_card_type" : "spairport_wireless_card_type_wifi (0x14E4, 0x4387)"
        }
      ],
      "spairport_software_information" : {
        "general_supported_phymodes" : "802.11 a/b/g/n/ac/ax"
      }
    }
  ]
}
`;

export const MACOS_TEXT = `Wi-Fi:

      Software Versions:
          CoreWLAN: 16.0 (1657)
          CoreWLANKit: 16.0 (1657)
      Interfaces:
        en0:
          Card Type: Wi-Fi  (0x14E4, 0x4387)
          Firmware Version: wl0: Aug 11 2026 03:11:02 version 23.40.12.0.41.51.201
          MAC Address: a6:83:e7:12:9c:44
          Locale: ETSI
          Country Code: GB
          Supported PHY Modes: 802.11 a/b/g/n/ac/ax
          Supported Channels: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 36, 40, 44, 48
          Wake On Wireless: Supported
          Status: Connected
          Current Network Information:
            Home-5G:
              PHY Mode: 802.11ax
              BSSID: <redacted>
              Channel: 149 (5GHz, 80MHz)
              Country Code: GB
              Network Type: Infrastructure
              Security: WPA3 Personal
              Signal / Noise: -52 dBm / -92 dBm
              Transmit Rate: 866
              MCS Index: 9
          Other Local Wi-Fi Networks:
            SKY-4F29:
              PHY Mode: 802.11n
              Channel: 6 (2GHz, 20MHz)
              Network Type: Infrastructure
              Security: WPA2 Personal
              Signal / Noise: -71 dBm / -93 dBm
            <redacted>:
              PHY Mode: 802.11ac
              Channel: 36 (5GHz, 80MHz)
              Network Type: Infrastructure
              Security: None
        awdl0:
          MAC Address: 8e:3c:1f:aa:22:01
          Status: Off
`;

export const NETSH = `
Interface name : Wi-Fi 
There are 3 networks currently visible. 

SSID 1 : Home-5G
    Network type            : Infrastructure
    Authentication          : WPA3-Personal
    Encryption              : CCMP 
    BSSID 1                 : a8:6b:ad:3c:11:2f
         Signal             : 92%  
         Radio type         : 802.11ax 
         Band               : 5 GHz 
         Channel            : 149 
         Basic rates (Mbps) : 6 12 24
         Other rates (Mbps) : 9 18 36 48 54

SSID 2 : SKY-4F29
    Network type            : Infrastructure
    Authentication          : WPA2-Personal
    Encryption              : CCMP 
    BSSID 1                 : 10:7b:44:9c:01:80
         Signal             : 70%  
         Radio type         : 802.11n 
         Band               : 2.4 GHz 
         Channel            : 6 
         Basic rates (Mbps) : 1 2 5.5 11
         Other rates (Mbps) : 6 9 12 18 24 36 48 54
    BSSID 2                 : 10:7b:44:9c:01:84
         Signal             : 31%  
         Radio type         : 802.11n 
         Band               : 2.4 GHz 
         Channel            : 11 
         Basic rates (Mbps) : 1 2 5.5 11
         Other rates (Mbps) : 6 9 12 18 24 36 48 54

SSID 3 : 
    Network type            : Infrastructure
    Authentication          : Open
    Encryption              : None 
    BSSID 1                 : 02:00:5e:10:00:01
         Signal             : 20%  
         Radio type         : 802.11ac 
         Band               : 5 GHz 
         Channel            : 36 
`;

/** The same, from a German Windows: labels differ, values keep their shape. */
export const NETSH_DE = `
Schnittstellenname : WLAN 
Aktuell sind 1 Netzwerke sichtbar. 

SSID 1 : Heimnetz
    Netzwerktyp             : Infrastruktur
    Authentifizierung       : WPA2-Personal
    Verschlüsselung         : CCMP 
    BSSID 1                 : 3c:a6:2f:00:11:22
         Signal             : 88%  
         Funktyp            : 802.11ac 
         Band               : 5 GHz 
         Kanal              : 44 
`;

export const NMCLI = `IN-USE  SSID           BSSID              CHAN  FREQ        RATE        SIGNAL  SECURITY
*       Home-5G        A8:6B:AD:3C:11:2F  149   5745 MHz    540 Mbit/s  82      WPA2 WPA3
        SKY-4F29       10:7B:44:9C:01:80  6     2437 MHz    130 Mbit/s  55      WPA2
        --             02:00:5E:10:00:01  1     2412 MHz    65 Mbit/s   40      --
        Corner Cafe    3C:A6:2F:00:11:22  11    2462 MHz    130 Mbit/s  62      WPA1 WPA2
        Studio-6G      3C:A6:2F:00:11:23  37    6115 MHz    1201 Mbit/s 70      WPA3
`;

/** The brief's own column set (no IN-USE). */
export const NMCLI_NO_INUSE = `SSID       BSSID              CHAN  FREQ      RATE        SIGNAL  SECURITY
Home-5G    A8:6B:AD:3C:11:2F  36    5180 MHz  540 Mbit/s  75      WPA2
`;

export const NMCLI_TERSE = `*:Home-5G:A8\\:6B\\:AD\\:3C\\:11\\:2F:149:5745 MHz:540 Mbit/s:82:WPA2 WPA3
:SKY-4F29:10\\:7B\\:44\\:9C\\:01\\:80:6:2437 MHz:130 Mbit/s:55:WPA2
::02\\:00\\:5E\\:10\\:00\\:01:1:2412 MHz:65 Mbit/s:40:
:Cafe\\: Guest:3C\\:A6\\:2F\\:00\\:11\\:22:11:2462 MHz:130 Mbit/s:62:WPA1 WPA2
`;

export const ARP_MACOS = `? (192.168.1.1) at 0:a:eb:3c:11:2f on en0 ifscope [ethernet]
router.lan (192.168.1.2) at a6:83:e7:12:9c:44 on en0 ifscope [ethernet]
? (192.168.1.50) at (incomplete) on en0 ifscope [ethernet]
? (192.168.1.255) at ff:ff:ff:ff:ff:ff on en0 ifscope [ethernet]
? (224.0.0.251) at 1:0:5e:0:0:fb on en0 ifscope permanent [ethernet]
`;

export const ARP_LINUX = `? (192.168.1.1) at a8:6b:ad:3c:11:2f [ether] on wlan0
gateway (192.168.1.2) at 10:7b:44:9c:01:80 [ether] on wlan0
? (192.168.1.77) at <incomplete> on wlan0
`;

export const ARP_WINDOWS = `
Interface: 192.168.1.20 --- 0x7
  Internet Address      Physical Address      Type
  192.168.1.1           a8-6b-ad-3c-11-2f     dynamic   
  192.168.1.255         ff-ff-ff-ff-ff-ff     static    
  224.0.0.22            01-00-5e-00-00-16     static    
  239.255.255.250       01-00-5e-7f-ff-fa     static    

Interface: 169.254.12.4 --- 0x12
  Internet Address      Physical Address      Type
  224.0.0.22            01-00-5e-00-00-16     static    
`;

export const IP_NEIGH = `192.168.1.1 dev wlan0 lladdr a8:6b:ad:3c:11:2f REACHABLE
192.168.1.12 dev wlan0 lladdr a6:83:e7:12:9c:44 STALE
192.168.1.50 dev wlan0  FAILED
fe80::aa6b:adff:fe3c:112f dev wlan0 lladdr a8:6b:ad:3c:11:2f router STALE
`;

export const NMAP_SN = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nmaprun>
<?xml-stylesheet href="file:///opt/homebrew/bin/../share/nmap/nmap.xsl" type="text/xsl"?>
<!-- Nmap 7.95 scan initiated Sun Nov 22 10:00:00 2026 as: nmap -sn -oX - 192.168.1.0/24 -->
<nmaprun scanner="nmap" args="nmap -sn -oX - 192.168.1.0/24" start="1795341600" startstr="Sun Nov 22 10:00:00 2026" version="7.95" xmloutputversion="1.05">
<verbose level="0"/>
<debugging level="0"/>
<host><status state="up" reason="arp-response" reason_ttl="0"/>
<address addr="192.168.1.1" addrtype="ipv4"/>
<address addr="A8:6B:AD:3C:11:2F" addrtype="mac" vendor="TP-Link"/>
<hostnames>
<hostname name="router.lan" type="PTR"/>
</hostnames>
<times srtt="2314" rttvar="5000" to="100000"/>
</host>
<host><status state="up" reason="arp-response" reason_ttl="0"/>
<address addr="192.168.1.12" addrtype="ipv4"/>
<address addr="A6:83:E7:12:9C:44" addrtype="mac"/>
<hostnames>
</hostnames>
<times srtt="14122" rttvar="5000" to="100000"/>
</host>
<host><status state="down" reason="no-response"/>
<address addr="192.168.1.99" addrtype="ipv4"/>
</host>
<host><status state="up" reason="localhost-response"/>
<address addr="192.168.1.20" addrtype="ipv4"/>
<hostnames>
<hostname name="macbook.lan" type="PTR"/>
</hostnames>
</host>
<runstats><finished time="1795341603" timestr="Sun Nov 22 10:00:03 2026" elapsed="2.97" summary="Nmap done at Sun Nov 22 10:00:03 2026; 256 IP addresses (3 hosts up) scanned in 2.97 seconds" exit="success"/><hosts up="3" down="253" total="256"/>
</runstats>
</nmaprun>
`;

export const NMAP_PORTS = `<?xml version="1.0" encoding="UTF-8"?>
<nmaprun scanner="nmap" args="nmap -oX - 192.168.1.40" version="7.95" xmloutputversion="1.05">
<host starttime="1" endtime="2"><status state="up" reason="arp-response"/>
<address addr="192.168.1.40" addrtype="ipv4"/>
<address addr="00:1B:A9:5D:20:6C" addrtype="mac" vendor="Brother Industries"/>
<ports><extraports state="closed" count="995"><extrareasons reason="resets" count="995"/></extraports>
<port protocol="tcp" portid="80"><state state="open" reason="syn-ack"/><service name="http" product="Debut embedded httpd" method="probed"/></port>
<port protocol="tcp" portid="515"><state state="open" reason="syn-ack"/><service name="printer" method="table"/></port>
<port protocol="tcp" portid="631"><state state="filtered" reason="no-response"/><service name="ipp" method="table"/></port>
<port protocol="tcp" portid="9100"><state state="open" reason="syn-ack"/><service name="jetdirect" method="table"/></port>
</ports>
<times srtt="3100" rttvar="5000" to="100000"/>
</host>
</nmaprun>
`;

export const TRACEROUTE_MACOS = `traceroute to example.com (93.184.216.34), 64 hops max, 40 byte packets
 1  192.168.1.1 (192.168.1.1)  2.345 ms  1.987 ms  2.012 ms
 2  100.64.0.1 (100.64.0.1)  9.104 ms  8.731 ms  10.220 ms
 3  * * *
 4  ae-1.r01.lon.example.net (203.0.113.5)  12.101 ms 203.0.113.6 (203.0.113.6)  13.020 ms  12.518 ms
 5  93.184.216.34 (93.184.216.34)  14.002 ms  *  13.644 ms
`;

export const TRACEROUTE_LINUX = `traceroute to example.com (93.184.216.34), 30 hops max, 60 byte packets
 1  _gateway (192.168.1.1)  1.201 ms  1.188 ms  1.176 ms
 2  10.20.0.1 (10.20.0.1)  8.412 ms  8.405 ms  8.399 ms
 3  192.168.1.5 (192.168.1.5)  3005.114 ms !H  *  *
 4  * * *
`;

export const TRACEROUTE_N = `traceroute to 1.1.1.1 (1.1.1.1), 30 hops max, 60 byte packets
 1  192.168.1.1  1.2 ms  1.1 ms  1.3 ms
 2  1.1.1.1  9.8 ms  9.7 ms  9.9 ms
`;

export const TRACERT = `
Tracing route to example.com [93.184.216.34]
over a maximum of 30 hops:

  1    <1 ms    <1 ms    <1 ms  192.168.1.1
  2     9 ms     8 ms    10 ms  100.64.0.1
  3     *        *        *     Request timed out.
  4    12 ms    13 ms    12 ms  ae-1.r01.lon.example.net [203.0.113.5]
  5    14 ms     *       14 ms  93.184.216.34

Trace complete.
`;

export const TRACERT_UNREACHABLE = `
Tracing route to 10.9.9.9 over a maximum of 30 hops

  1    <1 ms    <1 ms    <1 ms  192.168.1.1
  2  192.168.1.20  reports: Destination host unreachable.

Trace complete.
`;

export const MTR = `Start: 2026-11-23T10:00:00+0000
HOST: laptop                      Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 192.168.1.1                0.0%    10    2.1   2.3   1.9   3.5   0.5
  2.|-- ???                       100.0    10    0.0   0.0   0.0   0.0   0.0
  3.|-- 10.20.0.1                 30.0%    10    9.1   9.5   8.7  12.0   1.0
  4.|-- ae-1.r01.lon.example.net   0.0%    10   12.1  12.4  11.9  13.9   0.6
  5.|-- 93.184.216.34             20.0%    10   14.0  14.2  13.8  15.0   0.4
`;

export const MTR_REAL_LOSS = `Start: 2026-11-23T10:00:00+0000
HOST: laptop                      Loss%   Snt   Last   Avg  Best  Wrst StDev
  1.|-- 192.168.1.1                0.0%    10    2.1   2.3   1.9   3.5   0.5
  2.|-- 203.0.113.5               10.0%    10    9.1   9.5   8.7  12.0   1.0
  3.|-- 203.0.113.9               10.0%    10   12.1  12.4  11.9  13.9   0.6
`;
