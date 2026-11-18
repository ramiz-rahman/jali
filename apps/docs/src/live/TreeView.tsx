import type { DemoLayoutId } from "./demo";
/** A live workspace beside its layout tree, kept in step. STUB: the live agent builds it. */
export interface TreeViewProps {
  layout: DemoLayoutId;
  /** Show the JSON toggle. Default true. */
  json?: boolean;
  /** Height of the workspace in px. Default 360. */
  height?: number;
  caption?: string;
}
export function TreeView({ layout, caption }: TreeViewProps) {
  return <figure data-live="tree-view">TreeView: {layout}{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
}
