/**
 * The commands that make a scan, per operating system: what to run, what it shows, and what it cannot. Each is a
 * single line the person copies; none needs more than the OS provides, except nmap, which is optional.
 */
import type { ScanKind } from "./types";

export type Os = "macos" | "windows" | "linux";

export interface ScanCommand {
  kind: ScanKind;
  title: string;
  /** What it reads, in one line. */
  what: string;
  command: string;
  /** A second way, shown after the first. */
  alternative?: { command: string; label: string };
  /** What to know before running it. */
  caveat?: string;
}

export const OS_LABEL: Record<Os, string> = { macos: "macOS", windows: "Windows", linux: "Linux" };

export const COMMANDS: Record<Os, ScanCommand[]> = {
  macos: [
    {
      kind: "wifi",
      title: "Wi-Fi networks nearby",
      what: "Every network your Mac can hear: channel, width, signal and noise.",
      command: "system_profiler SPAirPortDataType -json",
      caveat:
        "Without Location Services permission for your terminal, macOS prints every network name as <redacted>. Channels and signals still come through, which is all the channel map needs.",
    },
    {
      kind: "devices",
      title: "Devices your Mac has talked to",
      what: "The ARP cache: every address on your subnet this Mac has exchanged packets with lately.",
      command: "arp -a",
      alternative: {
        label: "A sweep that finds the quiet ones too (needs nmap)",
        command: "nmap -sn -oX - 192.168.1.0/24",
      },
      caveat: "Replace 192.168.1.0/24 with your network (ifconfig shows your address and mask).",
    },
    {
      kind: "path",
      title: "The path to a host",
      what: "Each router between you and the destination, with three round-trip times.",
      command: "traceroute example.com",
      alternative: {
        label: "Loss per hop over ten probes (needs mtr)",
        command: "mtr --report -c 10 example.com",
      },
    },
  ],
  windows: [
    {
      kind: "wifi",
      title: "Wi-Fi networks nearby",
      what: "Every network and each access point (BSSID) with signal, radio type, band and channel.",
      command: "netsh wlan show networks mode=bssid",
      caveat:
        "Windows reports signal as a percentage, and no channel width: the map assumes a typical one and marks it as a guess.",
    },
    {
      kind: "devices",
      title: "Devices your PC has talked to",
      what: "The ARP cache: every address on your subnet this PC has exchanged packets with lately.",
      command: "arp -a",
      alternative: {
        label: "A sweep that finds the quiet ones too (needs nmap)",
        command: "nmap -sn -oX - 192.168.1.0/24",
      },
      caveat: "Windows lists each network adapter separately, including virtual ones.",
    },
    {
      kind: "path",
      title: "The path to a host",
      what: "Each router between you and the destination, with three round-trip times.",
      command: "tracert example.com",
    },
  ],
  linux: [
    {
      kind: "wifi",
      title: "Wi-Fi networks nearby",
      what: "Every network and access point with channel, frequency, rate, signal and security.",
      command: "nmcli -f IN-USE,SSID,BSSID,CHAN,FREQ,RATE,SIGNAL,SECURITY dev wifi list",
      alternative: {
        label: "Terse form",
        command: "nmcli -t -f IN-USE,SSID,BSSID,CHAN,FREQ,RATE,SIGNAL,SECURITY dev wifi list",
      },
      caveat:
        "NetworkManager reports signal as a 0 to 100 quality, and no channel width: the map marks the width as a guess.",
    },
    {
      kind: "devices",
      title: "Devices this machine has talked to",
      what: "The neighbour cache: every address on your subnet this machine has exchanged packets with lately.",
      command: "ip neigh",
      alternative: { label: "Or the older form, or a sweep (needs nmap)", command: "arp -a" },
    },
    {
      kind: "path",
      title: "The path to a host",
      what: "Each router between you and the destination, with three round-trip times.",
      command: "traceroute example.com",
      alternative: {
        label: "Loss per hop over ten probes (needs mtr)",
        command: "mtr --report -c 10 example.com",
      },
    },
  ],
};

/** The best guess of the visitor's OS from the browser, for the picker's first choice. */
export function guessOs(userAgent: string): Os {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Linux|X11/i.test(userAgent) && !/Android/i.test(userAgent)) return "linux";
  return "macos";
}
