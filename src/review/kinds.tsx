import { useEffect, useMemo, useRef } from "react";
import { Inbox } from "lucide-react";
import { definePaneKind, type PaneComponentProps } from "../ui/pane-kinds";
import { recordKind } from "../panes/kinds/record";
import { relatedKind } from "../panes/kinds/related";
import { isLoading, useRows } from "../data/hooks";
import { formatMoney, formatTimestamp } from "../panes/format";
import { PaneGate } from "../panes/shared/PaneGate";
import { Shell } from "../panes/shared/states";
import type { Row } from "../data/types";

const STATUS_ORDER: Record<string, number> = { pending: 0, returned: 1, approved: 2 };

/** The review queue: applications waiting first. Choosing one makes it the workspace's active item. */
function QueuePane({ paused, focused, activeItem, activate, setActivity }: PaneComponentProps) {
  const apps = useRows("loan_applications", { orderBy: "id ASC", limit: 200 }, { paused });
  const members = useRows("members", { orderBy: "id ASC", limit: 400 }, { paused });
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => setActivity(isLoading(apps) ? "loading" : apps.isError ? "error" : "idle"), [apps, setActivity]);
  const rows = useMemo(() => [...(apps.data?.rows ?? [])].sort((a, b) => (STATUS_ORDER[String(a.status)] ?? 9) - (STATUS_ORDER[String(b.status)] ?? 9) || Number(a.id) - Number(b.id)), [apps.data]);
  const names = useMemo(() => new Map((members.data?.rows ?? []).map((m: Row) => [Number(m.id), String(m.name)])), [members.data]);
  const at = rows.findIndex((r) => Number(r.id) === activeItem);
  useEffect(() => {
    if (focused && document.activeElement?.closest(".pane") === list.current?.closest(".pane")) list.current?.querySelector<HTMLElement>("[aria-selected=true]")?.focus({ preventScroll: true });
    list.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
  }, [at, focused]);

  if (isLoading(apps) || apps.isError) return <PaneGate queries={[apps]} />;
  const pending = rows.filter((r) => r.status === "pending").length;
  const go = (i: number) => { const r = rows[Math.max(0, Math.min(rows.length - 1, i))]; if (r) activate?.(Number(r.id)); };
  return (
    <Shell>
      <div className="pk-bar"><span className="grow pk-meta"><span className="pk-mono">{pending}</span> waiting · <span className="pk-mono">{rows.length}</span> this month</span><span className="pk-meta">J/K</span></div>
      <div className="rq-list" role="listbox" aria-label="Loan applications" ref={list}
        onKeyDown={(e) => {
          if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); go(at + 1); }
          else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); go(at - 1); }
        }}>
        {rows.map((r) => {
          const id = Number(r.id), selected = id === activeItem;
          return (
            <div key={id} role="option" aria-selected={selected} tabIndex={selected || (at < 0 && id === Number(rows[0]!.id)) ? 0 : -1}
              className="rq-item" data-status={String(r.status)} onClick={() => activate?.(id)}>
              <div className="rq-line">
                <span className="rq-name">{names.get(Number(r.member_id)) ?? `Member ${r.member_id}`}</span>
                <span className="rq-amount pk-mono">{formatMoney(Number(r.amount_cents))}</span>
              </div>
              <div className="rq-line pk-meta">
                <span>#{id} · {String(r.product)}</span>
                <span className="rq-status">{r.status === "pending" ? formatTimestamp(r.submitted_at)?.replace(/, .*/, "") : String(r.status)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export const queueKind = definePaneKind({
  kind: "review-queue", ref: () => ({ kind: "review-queue", params: {} }), title: () => "Applications",
  identity: () => "review-queue", recordable: false, item: true,
  minWidth: 260, minHeight: 200, icon: Inbox, Component: QueuePane,
});

/** Arrangement panes use the same record and related views with narrower minimums, so the review fits at 1440. */
export const reviewRecordKind = definePaneKind({ ...recordKind, kind: "review-record", ref: (params) => ({ kind: "review-record", params }), minWidth: 380 });
export const reviewRelatedKind = definePaneKind({ ...relatedKind, kind: "review-related", ref: (params) => ({ kind: "review-related", params }), minWidth: 360 });
