/**
 * What the packet panes share: reading a capture from the store, the gates every pane puts its content behind
 * (loading, failed, a file from an earlier session that has to be opened again, a packet number past the end), the
 * line that heads a packet, where its data came from, and opening a capture file of your own.
 */
import { useEffect, useState, type ReactNode } from "react";
import type { ObjectRef } from "jali";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import {
  captureState,
  captureStore,
  loadCapture,
  MAX_FILE_BYTES,
  openCaptureFile,
  type CaptureState,
} from "#src/packets/captures.ts";
import { highlightStore } from "#src/packets/highlight.ts";
import type { Capture, Packet } from "#src/packets/types.ts";
import { useFileDrop, type FileDrop } from "./file-drop";
import { Empty, Failed, Loading, MadeUp } from "./states";
import { useStore } from "./use-store";

/** What a pane that shows one packet takes from a selected packet: `follow` for the bytes and layers panes. */
export const followPacket = (s: ObjectRef) =>
  s.kind === "packet" ? { capture: String(s.params.capture), n: Number(s.params.n) } : undefined;

export function useCapture(id: string): CaptureState {
  useEffect(() => loadCapture(id), [id]);
  return useStore(captureStore, (all) => captureState(all, id));
}

/** The lit field's id for this packet, or null. */
export function useHighlight(key: string): string | null {
  return useStore(highlightStore, (h) => (h.key === key ? h.field : null));
}

/** Open a capture file, by picker or drop, reporting its new id to `onOpened`. */
export function useOpenCapture(
  onOpened: (id: string) => void,
): FileDrop & { busy: boolean; error?: string } {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const drop = useFileDrop({
    accept: ".pcap,.pcapng,.cap,.dmp,application/vnd.tcpdump.pcap",
    label: "Choose a capture file",
    onFiles: async ([file]) => {
      if (!file) return;
      setBusy(true);
      setError(undefined);
      try {
        onOpened(await openCaptureFile(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
  });
  return { ...drop, busy, error };
}

/** The button that opens a file, with the hidden input it needs and any error under it. */
export function OpenButton({
  onOpened,
  label = "Open .pcap…",
}: {
  onOpened: (id: string) => void;
  label?: string;
}) {
  const file = useOpenCapture(onOpened);
  return (
    <>
      <Button size="sm" onClick={file.pick} disabled={file.busy}>
        {file.busy ? "Reading…" : label}
      </Button>
      {file.input}
      {file.error ? (
        <Alert tone="danger" title="That file can't be read" className="pk-open-error">
          {file.error}
        </Alert>
      ) : null}
    </>
  );
}

/** How to record a capture of your own, on each OS. */
export function RecordSteps() {
  return (
    <div className="pk-record">
      <p>
        <b>macOS, Linux:</b> <code>sudo tcpdump -i en0 -w home.pcap</code>, then Ctrl+C. On Linux
        the interface is often <code>wlan0</code> or <code>eth0</code>; <code>-i any</code> takes
        them all (as Linux cooked frames). Add <code>-c 5000</code> to stop by itself.
      </p>
      <p>
        <b>Wireshark</b> on any OS: pick the interface, start, stop, File › Save As, pcapng.
      </p>
      <p>
        <b>Windows, nothing installed:</b> in an admin terminal,{" "}
        <code>pktmon start --capture --pkt-size 0</code>, then <code>pktmon stop</code> and{" "}
        <code>pktmon etl2pcap PktMon.etl -o home.pcapng</code>.
      </p>
      <p>
        The file is read in this tab and never uploaded. Up to {MAX_FILE_BYTES / 1024 / 1024} MB.
        Only on networks you are allowed to watch.
      </p>
    </div>
  );
}

/**
 * A capture's states before the content: loading (with progress for a big file), failed, and missing (a file from
 * an earlier session: its bytes were never stored, so the person opens it again, and `onOpened` gets its id).
 */
export function CaptureGate({
  id,
  onOpened,
  children,
}: {
  id: string;
  onOpened: (id: string) => void;
  children: (capture: Capture) => ReactNode;
}) {
  const state = useCapture(id);
  switch (state.status) {
    case "loading":
      return (
        <Loading
          label={
            state.total
              ? `Dissecting ${state.done.toLocaleString("en")} of ${state.total.toLocaleString("en")} packets`
              : "Building the capture"
          }
        />
      );
    case "failed":
      return <Failed title="The capture could not be built">{state.message}</Failed>;
    case "missing":
      return (
        <Empty
          title="This capture was a file you opened"
          action={<OpenButton onOpened={onOpened} label="Open the file again" />}
        >
          Files are read in the tab that opened them and never stored or uploaded, so after a reload
          the packets are gone. Open the same file again and these panes pick up where they were.
        </Empty>
      );
    case "ready":
      return <>{children(state.capture)}</>;
  }
}

/** One packet of a capture, behind the capture's gate, or why it is not there. */
export function PacketGate({
  capture: id,
  n,
  onOpened,
  children,
}: {
  capture: string;
  n: number;
  onOpened: (id: string) => void;
  children: (capture: Capture, p: Packet) => ReactNode;
}) {
  return (
    <CaptureGate id={id} onOpened={onOpened}>
      {(capture) => {
        const p = capture.packets[n - 1];
        return p ? (
          children(capture, p)
        ) : (
          <Empty title={`${capture.title} has no packet ${n}`}>
            It has {capture.packets.length} packets.
          </Empty>
        );
      }}
    </CaptureGate>
  );
}

/** "Generated capture" for the bundled ones; the file name for yours. */
export function Provenance({ capture }: { capture: Capture }) {
  return capture.madeUp ? (
    <MadeUp>Generated capture</MadeUp>
  ) : (
    <span className="pk-file">Your file · {capture.fileName}</span>
  );
}

/**
 * The line over a packet pane: its number and protocol, a detail, and any badges. Where the capture came from is
 * said once, by the dissection (`source`), not again by every pane beside it.
 */
export function PacketHead({
  capture,
  p,
  detail,
  className = "pk-packet-head",
  source = false,
  children,
}: {
  capture: Capture;
  p: Packet;
  detail: ReactNode;
  className?: string;
  source?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      <p className="pk-packet-title">
        <span className="pk-mono">#{p.n}</span> <b>{p.protocol}</b>{" "}
        <span className="pk-muted">{detail}</span>
      </p>
      {source ? <Provenance capture={capture} /> : null}
      {children}
    </div>
  );
}
