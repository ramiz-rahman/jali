import { useQuery } from "@tanstack/react-query";
import { PanelLeftOpen, PanelRightOpen, X } from "lucide-react";
import type { PaneNode } from "../../layout-core/types";
import type { TableName } from "../../data/types";
import { useDataLayer, type PaneActivity } from "../pane-kinds";
import { paneTitleId } from "../ids";
import { actions } from "../store";
import { KindIcon } from "../PaneFrame";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

/** Row count for kinds that have one: tables (from the catalog) and related lists (one-row probe, total only). */
function useRailCount(node: PaneNode): number | null {
  const layer = useDataLayer();
  const { kind, params } = node.ref;
  const table = String(params.table ?? "") as TableName;
  const where = kind === "related" ? { [String(params.column)]: params.value as string | number } : undefined;
  const q = useQuery(
    {
      queryKey: kind === "table" ? layer.keys.catalog() : layer.keys.rows(table, { where, limit: 1, offset: 0 }),
      queryFn: async () => (kind === "table" ? layer.api.catalog() : layer.api.rows(table, { where, limit: 1, offset: 0 })),
      enabled: kind === "table" || kind === "related",
    },
    layer.queryClient,
  );
  if (kind === "table") return (q.data as { name: string; rowCount: number }[] | undefined)?.find((t) => t.name === table)?.rowCount ?? null;
  if (kind === "related") return (q.data as { total: number } | undefined)?.total ?? null;
  return null;
}

type Act = PaneActivity | "done";
const ACT_WORD: Record<string, string> = { loading: "loading", working: "running", "needs-you": "needs you", error: "failed", done: "finished, not yet seen" };

/** Activity with a shape as well as a colour: ring, amber "!", accent dot, red cross. */
function RailActivity({ a }: { a: Act }) {
  if (a === "loading" || a === "working") return <span className={`ra ra-ring${a === "loading" ? " is-quiet" : ""}`} aria-hidden />;
  if (a === "needs-you") return <span className="ra ra-need" aria-hidden>!</span>;
  if (a === "error") return <span className="ra ra-fail" aria-hidden><X size={10} strokeWidth={3} /></span>;
  if (a === "done") return <span className="ra ra-done" aria-hidden />;
  return null;
}

/** A minimised pane in a row: the whole 56px rail is one button that expands it. */
export function RailButton({ node, title, activity, onLeft }: { node: PaneNode; title: string; activity: PaneActivity | undefined; onLeft: boolean }) {
  const count = useRailCount(node);
  const act = (activity ?? "idle") as Act | "idle";
  const parts = [`Expand ${title}`];
  if (count !== null) parts.push(`${full.format(count)} ${count === 1 ? "row" : "rows"}`);
  if (act !== "idle") parts.push(ACT_WORD[act] ?? act);
  const Open = onLeft ? PanelLeftOpen : PanelRightOpen;
  return (
    <button type="button" className="rail-btn" aria-label={parts.join(", ")} title={`Expand ${title} · ⌥⌘M`} onClick={() => actions.setCollapsed(node.id, false)}>
      <span className="rail-expand"><Open size={16} strokeWidth={1.5} aria-hidden /></span>
      <span className="rail-icon"><KindIcon kind={node.ref.kind} /></span>
      {count !== null ? <span className="rail-count">{compact.format(count)}</span> : null}
      {act !== "idle" ? <RailActivity a={act} /> : null}
      <span className="rail-title" id={paneTitleId(node.id)}>{title}</span>
    </button>
  );
}
