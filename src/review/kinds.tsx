import type { ReactNode } from "react";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { definePaneKind, type PaneComponentProps } from "../ui/pane-kinds";
import { useStore } from "../ui/state/react";
import { recordKind } from "../panes/kinds/record";
import { relatedKind } from "../panes/kinds/related";
import { Shell } from "../panes/shared/states";
import { day, taka, useApplication } from "./page";

/** One section of Overview, with a way to the full view. */
function Section({ title, role, children }: { title: string; role: string; children: ReactNode }) {
  const { actions } = useStore();
  return (
    <section className="ov-sec" aria-label={title}>
      <header className="ov-head">
        <h3>{title}</h3>
        <button className="ov-go" onClick={() => actions.openTab(role)} aria-label={`Open ${title}`} title="Open the full view · ⌥-click a tab to open it beside">
          {title} <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
        </button>
      </header>
      {children}
    </section>
  );
}

const Facts = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="ov-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
);

/** Overview: the designed page. Each question about the application gets a section; each section leads to its tab. */
function OverviewPane({ ref, paused }: PaneComponentProps) {
  const item = Number(ref.params.item);
  const { app, member, group, officer, loans } = useApplication(item, paused);
  const open = (loans ?? []).filter((l) => l.status !== "closed");
  const overdue = (loans ?? []).some((l) => l.status === "overdue");
  return (
    <Shell>
      <div className="ov">
        <Section title="Application" role="application">
          {app ? (
            <>
              <p className="ov-lead">{String(app.purpose)}</p>
              <Facts rows={[["Amount", taka(app.amount_cents)], ["Term", `${app.term_weeks} weeks`], ["Product", String(app.product)], ["Submitted", day(app.submitted_at)]]} />
            </>
          ) : null}
        </Section>
        <Section title="Borrower" role="borrower">
          {member ? <Facts rows={[["Name", String(member.name)], ["Occupation", String(member.occupation)], ["Household", `${member.household_size} people`], ["Savings", taka(member.savings_cents)]]} /> : null}
        </Section>
        <Section title="Loan history" role="history">
          {loans ? (
            <>
              <p className={overdue ? "ov-lead is-warn" : "ov-lead"}>
                {loans.length} {loans.length === 1 ? "loan" : "loans"} · {open.length ? `${taka(open.reduce((n, l) => n + Number(l.outstanding_cents), 0))} outstanding` : "nothing outstanding"}
                {overdue ? " · one overdue" : ""}
              </p>
              <table className="ov-table">
                <thead><tr><th>Cycle</th><th>Product</th><th className="num">Principal</th><th>Status</th></tr></thead>
                <tbody>{loans.map((l) => (
                  <tr key={String(l.id)} data-status={String(l.status)}><td className="num">{String(l.cycle)}</td><td>{String(l.product)}</td><td className="num">{taka(l.principal_cents)}</td><td>{String(l.status)}</td></tr>
                ))}</tbody>
              </table>
            </>
          ) : null}
        </Section>
        <Section title="Group" role="group">
          {group ? <Facts rows={[["Name", String(group.name)], ["Village", String(group.village)], ["Meets", String(group.meeting_day)]]} /> : null}
        </Section>
        <Section title="Field officer" role="officer">
          {officer ? <Facts rows={[["Name", String(officer.name)], ["Branch", String(officer.branch)], ["Phone", String(officer.phone)]]} /> : null}
        </Section>
      </div>
    </Shell>
  );
}

export const overviewKind = definePaneKind({
  kind: "review-overview", ref: (params) => ({ kind: "review-overview", params }), title: (r) => `application ${r.params.item} overview`,
  recordable: false, minWidth: 360, minHeight: 240, icon: LayoutDashboard, Component: OverviewPane,
});

/** The tabs' views use the same record and related views with narrower minimums, so two fit side by side at 1440. */
export const reviewRecordKind = definePaneKind({ ...recordKind, kind: "review-record", ref: (params) => ({ kind: "review-record", params }), minWidth: 380 });
export const reviewRelatedKind = definePaneKind({ ...relatedKind, kind: "review-related", ref: (params) => ({ kind: "review-related", params }), minWidth: 360 });
