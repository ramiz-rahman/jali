/**
 * What the scan panes share: finding the scan a pane was given (or showing why it is not there), and the strip at
 * the top of a scan pane that says whose data it is, where it stays, and how to forget it.
 */
import type { ReactNode } from "react";
import type { PaneProps } from "jali-layout/react";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { formatInfo } from "#src/scans/detect.ts";
import { kindName } from "#src/scans/kinds.ts";
import { scanRef, scansRef } from "#src/scans/refs.ts";
import { isKind, scanStore, type LoadedScan } from "#src/scans/store.ts";
import type { ScanKind } from "#src/scans/types.ts";
import { Empty, MadeUp } from "./states";
import { useStore } from "./use-store";

const time = (ms: number) =>
  new Date(ms).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** Every loaded scan, the person's newest first, then the samples. */
export const useScans = () => useStore(scanStore.state, (s) => s.scans);

/** "Sample · made up" for the bundled scans, "Your scan" for the person's. */
export function ScanOwner({ loaded }: { loaded: LoadedScan }) {
  return loaded.sample ? (
    <MadeUp>Sample · made up</MadeUp>
  ) : (
    <Badge tone="ok" title="A scan you added. It is kept in this browser only.">
      Your scan
    </Badge>
  );
}

/** The strip over a scan pane's content. */
export function ScanHead({ loaded, children }: { loaded: LoadedScan; children?: ReactNode }) {
  return (
    <header className="scan-head">
      <div className="scan-head-line">
        <b className="scan-head-title">{loaded.title}</b>
        <ScanOwner loaded={loaded} />
        <span className="scan-head-format">{formatInfo(loaded.format).label}</span>
        {loaded.addedAt ? <span className="scan-head-format">{time(loaded.addedAt)}</span> : null}
      </div>
      {children}
      {loaded.sample ? null : (
        <div className="scan-head-line">
          <span className="scan-note">Never leaves this browser.</span>
          <Button size="sm" tone="ghost" onClick={() => scanStore.forget(loaded.id)}>
            Forget this scan
          </Button>
        </div>
      )}
    </header>
  );
}

/**
 * The scan a pane shows, typed as the pane's kind, or the pane's empty state: the id is not loaded (forgotten, or
 * a link from another browser: scans do not travel), or it is a scan of another kind.
 */
export function ScanGate<K extends ScanKind>({
  id,
  kind,
  openBeside,
  openHere,
  children,
}: Pick<PaneProps, "openBeside" | "openHere"> & {
  id: string;
  kind: K;
  children: (loaded: LoadedScan<K>) => ReactNode;
}) {
  const loaded = useStore(scanStore.state, (s) => s.scans.find((x) => x.id === id));
  if (!loaded) {
    return (
      <Empty
        title={`No ${kindName(kind)} scan called ${id}`}
        action={
          <Button tone="primary" onClick={() => openBeside(scansRef)}>
            Open Scans
          </Button>
        }
      >
        Scans stay in the browser that made them, so a link or a reload may not find one. Open Scans
        to run a command and paste its output, or to use the made-up samples.
      </Empty>
    );
  }
  if (!isKind(loaded, kind)) {
    return (
      <Empty
        title={`This is a ${kindName(loaded.kind)} scan`}
        action={
          <Button tone="primary" onClick={() => openHere(scanRef(loaded.kind, loaded.id))}>
            Show it as {kindName(loaded.kind)}
          </Button>
        }
      >
        {loaded.title} is not {kindName(kind)} data. The {kindName(loaded.kind)} pane reads it.
      </Empty>
    );
  }
  return <>{children(loaded)}</>;
}
