/**
 * Overview: the designed page. It answers "should this loan be approved?" with what the header does not show: how the
 * borrower has repaid, what they owe, how big a step this is, how their group stands and how loaded their officer is.
 * Each section leads to its tab.
 */
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { PaneComponentProps } from "@jali/react";
import { useStore } from "@jali/react";
import { Loading } from "../panes/shared/states";
import { day, taka, useApplication } from "./page";
import { book, instalments, plural, tenure, useGroupStanding, useOfficerBook, useRepayments, type Row } from "./data";
import { Ladder, Standing } from "./records";
import { signals } from "./signals";
import { Facts, Instalments, StatusMark, Table, ToneIcon, View } from "./ui";
import { altClick } from "@jali/core";

const n = (v: unknown) => Number(v ?? 0);

/** One section of Overview, with a way to the full view. */
function Section({ title, role, lead, warn, children, area }: { title: string; role: string; lead?: ReactNode; warn?: boolean; children: ReactNode; area: string }) {
  const { actions } = useStore();
  return (
    <section className="ov-sec" aria-label={title} style={{ gridArea: area }}>
      <header className="ov-head">
        <h3>{title}</h3>
        <button className="ov-go" onClick={() => actions.openTab(role)} aria-label={`Open ${title}`} title={`Open the full view · ${altClick()} a tab to open it beside`}>
          <span className="ov-go-text">View</span> <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
        </button>
      </header>
      {lead ? <p className={warn ? "ov-lead is-warn" : "ov-lead"}>{lead}</p> : null}
      {children}
    </section>
  );
}

export function OverviewPane({ ref, paused }: PaneComponentProps) {
  const item = Number(ref.params.item);
  const { app, member, group, officer, loans } = useApplication(item, paused);
  const pay = useRepayments((loans ?? []).map((l) => n(l.id)), paused);
  const repayments = pay.ready && loans ? [...pay.byLoan.values()].flat() : undefined;
  const { members, standing } = useGroupStanding(group, paused);
  const office = useOfficerBook(officer ? n(officer.id) : undefined, paused);
  const caseload = office.loans ? book(office.loans) : undefined;
  if (!app) return <View label="Overview"><Loading /></View>;

  const b = loans ? book(loans) : undefined;
  const paid = repayments ? instalments(repayments) : undefined;
  const found = signals({ app, member, loans, repayments, group, standing, officer, caseload });
  const weekly = n(app.amount_cents) / Math.max(1, n(app.term_weeks));
  return (
    <View label="Overview">
      <div className="ov">
        <section className="ov-checks" aria-label="What to check" style={{ gridArea: "checks" }}>
          <h3 className="ov-checks-title">What to check</h3>
          <ul>
            {found.map((s) => (
              <li key={s.id} data-tone={s.tone}><ToneIcon tone={s.tone} /><span><b>{s.text}</b>{s.detail ? <span className="ov-detail">{s.detail}</span> : null}</span></li>
            ))}
            {!found.length ? <li data-tone="info"><Loading /></li> : null}
          </ul>
        </section>

        <Section title="Loan history" role="history" area="history" warn={!!b?.overdue}
          lead={loans ? <>{plural(loans.length, "loan")} · {b!.active ? `${taka(b!.outstanding)} outstanding` : "nothing outstanding"}{b!.overdue ? ` · ${b!.overdue} overdue` : ""}</> : "…"}>
          {loans?.length ? (
            <Table label="Loans, newest first" rows={loans} rowKey={(l) => String(l.id)} rowAttrs={(l) => ({ "data-status": String(l.status) })}
              stack={(l) => [[2, String(l.product)]]} cols={[
                { key: "cycle", head: "Cycle", pri: 1, cell: (l) => `Cycle ${l.cycle}` },
                { key: "product", head: "Product", pri: 2, cell: (l) => String(l.product) },
                { key: "principal", head: "Principal", pri: 1, num: true, cell: (l) => taka(l.principal_cents) },
                { key: "status", head: "Status", pri: 1, cell: (l) => <StatusMark status={l.status} /> },
                { key: "paid", head: "Instalments", pri: 2, cell: (l: Row) => <Instalments rows={pay.byLoan.get(n(l.id))} /> },
              ]} />
          ) : loans ? <p className="rv-muted">First loan with us: no repayment record yet.</p> : null}
          {paid && paid.total ? <p className="ov-foot">{paid.onTime} of {paid.total} instalments on time{paid.late ? `, ${paid.late} late` : ""}{paid.missed ? `, ${paid.missed} missed` : ""}.</p> : null}
        </Section>

        <Section title="Application" role="application" area="application"
          lead={<>{taka(app.amount_cents)} over {String(app.term_weeks)} weeks · {taka(weekly)} a week</>}>
          {loans ? <Ladder loans={loans} request={n(app.amount_cents)} /> : null}
        </Section>

        <Section title="Borrower" role="borrower" area="borrower" lead={member ? `${member.occupation} · household of ${member.household_size}` : "…"}>
          {member ? <Facts cols={1} rows={[
            ["Member for", tenure(member.joined_on, app.submitted_at), `since ${day(member.joined_on)}`],
            ["Savings", taka(member.savings_cents), `${(n(member.savings_cents) / weekly).toFixed(1)} weeks of instalments`],
            ["Owed now", b ? (b.outstanding ? taka(b.outstanding) : "Nothing") : "…"],
          ]} /> : null}
        </Section>

        <Section title="Group" role="group" area="group"
          lead={group ? `${group.name} · ${group.village}, meets ${group.meeting_day}` : "…"}>
          {standing ? <Standing s={standing} members={members?.length} /> : null}
        </Section>

        <Section title="Field officer" role="officer" area="officer"
          lead={officer ? `${officer.name} · ${officer.branch} branch` : "…"}>
          {caseload ? <Standing s={caseload} groups={office.groups?.length} /> : null}
        </Section>
      </div>
    </View>
  );
}
