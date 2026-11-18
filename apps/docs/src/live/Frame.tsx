import type { DemoLayoutId } from "./demo";
/** A live workspace in a frame the reader can resize, to watch panes fold and return. STUB: the live agent builds it. */
export interface FrameProps {
  layout: DemoLayoutId;
  /** Starting width in px; the reader can drag between minWidth and the column. */
  width?: number;
  minWidth?: number;
  height?: number;
  caption?: string;
}
export function Frame({ layout, caption }: FrameProps) {
  return <figure data-live="frame">Frame: {layout}{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
}
