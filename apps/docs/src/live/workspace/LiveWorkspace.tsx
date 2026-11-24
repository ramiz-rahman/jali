/**
 * One live workspace inside a docs figure, in a box of a fixed height. The box holds the Jali root and its dialogs,
 * and is the keyboard's scope: keys count for this workspace only when pressed inside it (or on the page body right
 * after using it). The instance comes from ./useLiveStore or ./embedded.
 */
import type { Ref } from "react";
import type { Jali } from "jali-layout";
import { JaliRoot, JaliView, Shelf } from "jali-layout/react";
import { useEngineModel } from "./engine";
import { ClientOnly } from "./ClientOnly";

/** The status line under the panes: the shelf (tucked panes) and a count. */
function LiveStatus() {
  const m = useEngineModel();
  const tucked = m.shelf.length,
    folded = m.folded.length,
    n = m.visible.length;
  return (
    <footer className="live-statusbar" data-one-pane={m.onePane || undefined}>
      <Shelf />
      <span className="live-statusbar-count">
        {n} on screen{folded ? ` · ${folded} folded` : ""}
        {tucked ? ` · ${tucked} tucked` : ""}
      </span>
    </footer>
  );
}

export interface LiveWorkspaceProps {
  jali: Jali;
  /** Height of the whole workspace (panes and status line): px, or a CSS length. */
  height: number | string;
  wrapRef?: Ref<HTMLDivElement>;
  className?: string;
  /** The status line under the panes (the shelf and a count). Default true. */
  status?: boolean;
}

export function LiveWorkspace({
  jali,
  height,
  wrapRef,
  className,
  status = true,
}: LiveWorkspaceProps) {
  return (
    <div
      className={className ? `live-ws ${className}` : "live-ws"}
      ref={wrapRef}
      style={{ height }}
    >
      <ClientOnly>
        <JaliRoot jali={jali} className="live-jali">
          <JaliView />
          {status ? <LiveStatus /> : null}
        </JaliRoot>
      </ClientOnly>
    </div>
  );
}

/**
 * A workspace standing on its own (not in a figure with a caption): a group named `label`, so a screen reader hears
 * what it is. `height="100%"` fills the box it is placed in.
 */
export function NamedWorkspace({
  jali,
  height,
  label,
}: {
  jali: Jali;
  height: number | string;
  label: string;
}) {
  return (
    <div
      className="live-figure landing-ws"
      role="group"
      aria-label={label}
      // Inline: a figure's margin is the live layer's, which the landing's own styles can't reach.
      style={{ margin: 0, height: height === "100%" ? "100%" : undefined }}
    >
      <LiveWorkspace jali={jali} height={height} className="landing-ws-box" status={false} />
    </div>
  );
}
