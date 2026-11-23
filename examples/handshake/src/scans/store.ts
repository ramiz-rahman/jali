/**
 * The scans the panes read: three made-up samples, and the ones the person pasted or dropped. Their text is kept
 * in this browser's localStorage (nowhere else: nothing here makes a request) and parsed again on load, so a parser
 * fix applies to old scans and nothing about the parsed shape is ever stored. Every storage access is guarded: with
 * storage blocked or full, scans live for the session and the pane says so.
 */
import { createStore, type Store } from "#src/store.ts";
import { parseScan, type Detected } from "./detect";
import { describeScan, type ScanOf } from "./kinds";
import { SAMPLE_DEVICES, SAMPLE_PATH, SAMPLE_WIFI } from "./samples";
import type { FormatId, ScanKind } from "./types";

export const SAMPLE_IDS = {
  wifi: "sample-wifi",
  devices: "sample-devices",
  path: "sample-path",
} as const;

interface ScanEntry {
  id: string;
  format: FormatId;
  /** Short title for lists and pane headers. */
  title: string;
  sample: boolean;
  /** When the person added it (ms); samples have none. */
  addedAt?: number;
}

/** A scan as the panes see it, its kind and parsed data paired (one of three shapes, never mixed). */
export type LoadedScan<K extends ScanKind = ScanKind> = K extends ScanKind
  ? ScanEntry & { kind: K; scan: ScanOf<K> }
  : never;

/** Whether a loaded scan is of `kind`, with its scan typed as that kind's. */
export const isKind = <K extends ScanKind>(loaded: LoadedScan, kind: K): loaded is LoadedScan<K> =>
  loaded.scan.kind === kind;

interface Stored {
  id: string;
  text: string;
  addedAt: number;
}

const KEY = "handshake.scans";
/** localStorage holds about 5 MB; a Wi-Fi JSON is tens of KB. Past this a new scan is kept for the session only. */
const BUDGET = 1_500_000;

/** FNV-1a, 32 bit, base 36: the same text always gets the same id, so pasting twice is one scan. */
export function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, "0");
}

/** A scan as the panes see it, parsed from its text. */
function loadedOf(
  text: string,
  own: { id: string; sample: boolean; addedAt?: number },
): LoadedScan[] {
  const r = parseScan(text);
  if (!r.ok) return [];
  const title = describeScan(r.scan).title(r.scan);
  return [{ ...own, kind: r.scan.kind, format: r.format, title, scan: r.scan } as LoadedScan];
}

type Backing = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface ScanState {
  /** Every loaded scan: the person's, newest first, then the samples. */
  scans: readonly LoadedScan[];
  /** False when storage was refused, so scans last only until the tab closes. */
  persisted: boolean;
}

export interface ScanStore {
  /** What the panes read (`useStore(scanStore.state)`). */
  state: Store<ScanState>;
  list(): readonly LoadedScan[];
  get(id: string): LoadedScan | undefined;
  add(text: string): Detected & { id?: string };
  forget(id: string): void;
  forgetAll(): void;
  persisted(): boolean;
}

/** A store over a `Storage` (or none). Tests pass a map-backed one; the app passes localStorage. */
export function createScanStore(backing: Backing | undefined): ScanStore {
  const samples = [
    { id: SAMPLE_IDS.wifi, text: SAMPLE_WIFI },
    { id: SAMPLE_IDS.devices, text: SAMPLE_DEVICES },
    { id: SAMPLE_IDS.path, text: SAMPLE_PATH },
  ].flatMap(({ id, text }) => loadedOf(text, { id, sample: true }));

  let stored: Stored[] = [];
  let ok = backing !== undefined;
  try {
    const raw = backing?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      stored = parsed.filter(
        (s): s is Stored =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as Stored).id === "string" &&
          typeof (s as Stored).text === "string",
      );
    }
  } catch {
    // Unreadable or blocked: start empty, and the pane says scans are not being kept.
    ok = false;
  }

  const snapshot = (): ScanState => ({
    // Newest first; the samples stay at the end.
    scans: [
      ...stored
        .flatMap((s) => loadedOf(s.text, { id: s.id, sample: false, addedAt: s.addedAt }))
        .sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0)),
      ...samples,
    ],
    persisted: ok,
  });
  const state = createStore(snapshot());

  const save = () => {
    try {
      const text = JSON.stringify(stored);
      if (text.length > BUDGET) {
        ok = false;
        return;
      }
      if (stored.length) backing?.setItem(KEY, text);
      else backing?.removeItem(KEY);
      ok = backing !== undefined;
    } catch {
      ok = false;
    }
  };

  const emit = () => state.set(snapshot());

  return {
    state,
    list: () => state.get().scans,
    get: (id) => state.get().scans.find((s) => s.id === id),
    add(text) {
      const r = parseScan(text);
      if (!r.ok) return r;
      const id = `scan-${hashOf(`${r.scan.kind}:${text.trim()}`)}`;
      if (!stored.some((s) => s.id === id)) {
        stored = [...stored, { id, text, addedAt: Date.now() }];
        save();
      }
      emit();
      return { ...r, id };
    },
    forget(id) {
      stored = stored.filter((s) => s.id !== id);
      save();
      emit();
    },
    forgetAll() {
      stored = [];
      save();
      emit();
    },
    persisted: () => state.get().persisted,
  };
}

function localStore(): Backing | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The app's one store. */
export const scanStore = createScanStore(typeof window === "undefined" ? undefined : localStore());
