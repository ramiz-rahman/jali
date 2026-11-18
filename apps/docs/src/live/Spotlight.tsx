import type { DemoLayoutId } from "./demo";
/** A live workspace dimmed except one part. STUB: the live agent builds it. */
export interface SpotlightProps {
  layout: DemoLayoutId;
  /** What to light: a CSS selector inside the workspace, or a named part. */
  target: "shelf" | "follow" | "drop-zones" | "tabs" | "divider" | (string & {});
  height?: number;
  caption?: string;
}
export function Spotlight({ layout, target, caption }: SpotlightProps) {
  return <figure data-live="spotlight">Spotlight: {layout} / {target}{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
}
