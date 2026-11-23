/**
 * The captures the packet panes show: the bundled ones, generated into real pcap bytes and read back through the
 * same reader and dissectors as a file you open, and your own files, which stay in this tab. A capture is loaded
 * once and kept in `captureStore`, which the panes read (panes/parts/capture.tsx).
 */
import { CaptureError, readCapture } from "./read";
import { dissectAll } from "./dissect";
import { SCRIPTS, type BundledId, type Script } from "./generate/scripts/index";
import { createStore } from "#src/store.ts";
import { writePcap, writePcapng } from "./generate/write";
import type { Capture } from "./types";

/** The bundled captures, in menu order: id, title and what each one shows. */
export const CAPTURES = Object.entries(SCRIPTS).map(([id, s]) => ({
  id: id as BundledId,
  title: s.title,
  summary: s.summary,
}));

/** The comparison the lab offers first: HTTPS over TCP and TLS 1.3, against HTTP/3 over QUIC. */
export const DEFAULT_COMPARISON = { a: "tls13", b: "quic-h3" } as const satisfies Record<
  string,
  BundledId
>;

/** The capture to set beside `id` in a comparison: QUIC against TCP and TLS, anything else against QUIC. */
export const counterpart = (id: string): BundledId =>
  id === DEFAULT_COMPARISON.b ? DEFAULT_COMPARISON.a : DEFAULT_COMPARISON.b;

const isBundled = (id: string): id is BundledId => id in SCRIPTS;

const scripts = new Map<BundledId, Script>();
function script(id: BundledId): Script {
  let s = scripts.get(id);
  if (!s) {
    s = SCRIPTS[id].build();
    scripts.set(id, s);
  }
  return s;
}

/** A bundled capture's packet number for a mark ("syn-ack"), or undefined for an unknown capture or mark. */
export function captureMark(id: string, mark: string): number | undefined {
  return isBundled(id) ? script(id).marks[mark] : undefined;
}

/** Every mark of a bundled capture, by packet number. */
export function marksOf(id: string): Readonly<Record<string, number>> {
  return isBundled(id) ? script(id).marks : {};
}

/** The bundled capture as file bytes: pcap, nanosecond pcap or pcapng, as its script says. */
export async function bundledFile(id: BundledId): Promise<Uint8Array> {
  const s = script(id);
  const frames = await Promise.all(
    s.frames.map(async (f) => ({
      time: f.time,
      data: typeof f.bytes === "function" ? await f.bytes() : f.bytes,
    })),
  );
  return s.format === "pcapng"
    ? writePcapng(frames)
    : writePcap(frames, { nano: s.format === "pcap-ns" });
}

/** Read and dissect capture bytes. Throws a `CaptureError` that says what is wrong with a bad file. */
export async function parseCapture(
  bytes: Uint8Array,
  meta: Pick<Capture, "id" | "title" | "summary" | "madeUp" | "fileName">,
  onProgress?: (done: number, total: number) => void,
): Promise<Capture> {
  const raw = readCapture(bytes);
  if (raw.frames.length === 0)
    throw new CaptureError("The file is a valid capture with no packets in it.");
  const packets = await dissectAll(raw.frames, (done) => onProgress?.(done, raw.frames.length));
  return {
    ...meta,
    format: raw.format,
    packets,
    marks: marksOf(meta.id),
    warnings: raw.warnings,
  };
}

// The store: one load per capture, shared by every pane that shows it.

export type CaptureState =
  | { status: "loading"; done: number; total: number }
  | { status: "ready"; capture: Capture }
  | { status: "failed"; message: string }
  /** A file opened in an earlier session: its bytes were never stored, so it is gone. */
  | { status: "missing" };

export const captureStore = createStore<Readonly<Record<string, CaptureState>>>({});

const LOADING: CaptureState = { status: "loading", done: 0, total: 0 };
const MISSING: CaptureState = { status: "missing" };

const set = (id: string, state: CaptureState) =>
  captureStore.update((all) => ({ ...all, [id]: state }));

/** What is known of a capture now: a bundled one not yet loaded is loading (`loadCapture` starts it). */
export function captureState(
  all: Readonly<Record<string, CaptureState>>,
  id: string,
): CaptureState {
  return all[id] ?? (isBundled(id) ? LOADING : MISSING);
}

/** Start loading a bundled capture the first time a pane asks for it; anything else is already known or gone. */
export function loadCapture(id: string) {
  if (captureStore.get()[id] || !isBundled(id)) return;
  set(id, LOADING);
  void loadBundled(id);
}

async function loadBundled(id: BundledId) {
  try {
    const bytes = await bundledFile(id);
    const { title, summary } = SCRIPTS[id];
    const capture = await parseCapture(bytes, { id, title, summary, madeUp: true });
    set(id, { status: "ready", capture });
  } catch (e) {
    set(id, { status: "failed", message: e instanceof Error ? e.message : String(e) });
  }
}

/** The name of a capture for a pane title, before or after it loads. */
export const captureTitle = (id: string): string => {
  const state = captureStore.get()[id];
  if (state?.status === "ready") return state.capture.title;
  return isBundled(id) ? SCRIPTS[id].title : isFileId(id) ? "Your capture" : id;
};

/** Larger files take minutes to dissect in a tab; cut them first (editcap -c 50000, or tcpdump -c). */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

/** A file's capture id: `file-` and a hash of its bytes, so opening the same file again lands on the same panes. */
const FILE_PREFIX = "file-";
const isFileId = (id: string) => id.startsWith(FILE_PREFIX);

async function fileId(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  return (
    FILE_PREFIX + Array.from(digest.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

/**
 * Open a file the person chose. It is read here, in this tab, and never sent anywhere. Resolves to the capture's
 * id; a file that can't be read rejects with a message that says why.
 */
export async function openCaptureFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new CaptureError(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB. Cut it first: editcap -c 50000 in.pcapng out.pcapng.`,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = await fileId(bytes);
  if (captureStore.get()[id]?.status === "ready") return id;
  set(id, LOADING);
  try {
    const capture = await parseCapture(
      bytes,
      { id, title: file.name, summary: "", madeUp: false, fileName: file.name },
      (done, total) => set(id, { status: "loading", done, total }),
    );
    set(id, { status: "ready", capture });
    return id;
  } catch (e) {
    captureStore.update(({ [id]: _gone, ...rest }) => rest);
    throw e instanceof CaptureError
      ? e
      : new CaptureError(
          `${file.name} could not be read: ${e instanceof Error ? e.message : String(e)}`,
        );
  }
}
