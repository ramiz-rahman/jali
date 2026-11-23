/**
 * What the app says about each kind of scan, in one table: its name, how much it holds, a few words on what is in
 * it, and its title. Lists, titles, the paste preview and the scan panes all read it, so a new kind is one entry.
 */
import type { ScanData, ScanKind } from "./types";

export type ScanOf<K extends ScanKind> = Extract<ScanData, { kind: K }>;

interface KindInfo<K extends ScanKind> {
  /** The pane that reads it: "Wi-Fi", "Devices", "Path". */
  name: string;
  /** How much it holds: "12 networks". */
  count: (scan: ScanOf<K>) => string;
  /** What is in it, in a few words, for the list of loaded scans. */
  summary: (scan: ScanOf<K>) => string;
  /** Its short title for lists and pane headers. */
  title: (scan: ScanOf<K>) => string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const SCAN_KINDS: { [K in ScanKind]: KindInfo<K> } = {
  wifi: {
    name: "Wi-Fi",
    count: (s) => plural(s.networks.length, "network"),
    summary: (s) =>
      [...new Set(s.networks.flatMap((n) => (n.band ? [`${n.band} GHz`] : [])))].join(", ") ||
      "no channels",
    title: (s) => `Wi-Fi · ${plural(s.networks.length, "network")}`,
  },
  devices: {
    name: "Devices",
    count: (s) => plural(s.devices.length, "entry", "entries"),
    summary: (s) => `${s.devices.filter((d) => d.mac).length} with a MAC`,
    title: (s) => `Devices · ${plural(s.devices.length, "entry", "entries")}`,
  },
  path: {
    name: "Path",
    count: (s) => plural(s.hops.length, "hop"),
    summary: (s) => (s.hops.some((h) => h.rtts.length) ? `to ${s.hops.length} hops` : "no hops"),
    title: (s) => `Path${s.target ? ` to ${s.target}` : ""} · ${plural(s.hops.length, "hop")}`,
  },
};

/** The name of a kind of scan: "Wi-Fi". */
export const kindName = (kind: ScanKind) => SCAN_KINDS[kind].name;

/** What the app says about this scan. The one cast: TypeScript cannot pair a union's kind with its own entry. */
export const describeScan = <S extends ScanData>(scan: S) =>
  SCAN_KINDS[scan.kind] as unknown as KindInfo<S["kind"]>;
