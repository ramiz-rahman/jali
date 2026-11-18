/**
 * The loan-review list views: a borrower's loan history (or an officer's loans), and the members, applications and
 * groups that records link to. Reviewer tables, not grids: the columns a decision needs first, the rest as the view widens.
 */
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import type { PaneComponentProps } from "@jali/react";
import { useUi } from "@jali/react";
import { isLoading, useRows } from "../data/hooks";
import type { TableName } from "../data/types";
import { PaneGate } from "../panes/shared/PaneGate";
import { Empty } from "../panes/shared/states";
import { RelatedPane } from "../panes/kinds/related";
import { day, taka } from "./page";
import { book, instalments, plural, useMemberNames, useRepayments, type Row } from "./data";
import { Instalments, recordRef, RefLink, StatusMark, Table, View, ViewHead, type Col } from "./ui";

const n = (v: unknown) => Number(v ?? 0);
type Open = PaneComponentProps["openBeside"];
interface ListProps { rows: Row[]; column: string; label: string; open: Open; paused: boolean }

const ORDER: Partial<Record<TableName, string>> = { loans: "cycle DESC", members: "name ASC", loan_applications: "submitted_at DESC", lending_groups: "name ASC" };

/** Rows of a loan-book table where one column has one value; tables without a designed list use the Data Studio grid. */
export function ReviewRelatedPane(p: PaneComponentProps) {
  const { table, column, value, label } = p.ref.params;
  const t = String(table) as TableName;
  const L = LISTS[t];
  const q = useRows(t, { where: { [String(column)]: value as number }, orderBy: ORDER[t], limit: 500 }, { paused: p.paused || !L });
  const { setActivity } = p;
  useEffect(() => { if (L) setActivity(isLoading(q) ? "loading" : q.isError ? "error" : "idle"); }, [L, setActivity, q]);
  if (!L) return <RelatedPane {...p} />;
  if (isLoading(q) || q.isError || !q.data) return <PaneGate queries={[q]} onRetry={() => { void q.refetch(); }} />;
  return <L rows={q.data.rows} column={String(column)} label={String(label ?? "")} open={p.openBeside} paused={p.paused} />;
}

/* ---------- loans ---------- */

/** A borrower's loans (or an officer's): what they borrowed, what is owed, and how they repaid, newest cycle first. */
function LoanList({ rows: loans, column, label, open, paused }: ListProps) {
  const byOfficer = column !== "member_id";
  const names = useMemberNames(paused || !byOfficer);
  const pay = useRepayments(byOfficer ? [] : loans.map((l) => n(l.id)), paused);
  const all = [...pay.byLoan.values()].flat();
  const paid = instalments(all);
  const b = book(loans);
  const borrowed = loans.reduce((s, l) => s + n(l.principal_cents), 0);
  const overdue = loans.filter((l) => l.status === "overdue");
  if (!loans.length) return <View label={label}><Empty title="No loans yet" hint="This is a first loan: there is no repayment record to read." /></View>;

  const cycle: Col<Row> = { key: "cycle", head: "Cycle", pri: byOfficer ? 2 : 1, cell: (l) => <RefLink to={recordRef("loans", l.id)} open={open} name={`loan ${l.id}, cycle ${l.cycle}`} className="rv-link rv-cycle">Cycle {String(l.cycle)}</RefLink> };
  const who: Col<Row> = { key: "who", head: "Borrower", pri: 1, cell: (l) => <RefLink to={recordRef("loans", l.id)} open={open} name={`loan ${l.id}`} className="rv-link">{names.get(n(l.member_id)) ?? `Member ${l.member_id}`}</RefLink> };
  const cols: Col<Row>[] = [
    ...(byOfficer ? [who] : []),
    cycle,
    { key: "product", head: "Product", pri: 2, cell: (l) => String(l.product) },
    { key: "principal", head: "Principal", pri: 1, num: true, cell: (l) => taka(l.principal_cents) },
    { key: "outstanding", head: "Outstanding", pri: 2, num: true, cell: (l) => (n(l.outstanding_cents) ? taka(l.outstanding_cents) : <span className="rv-muted">–</span>) },
    { key: "status", head: "Status", pri: 1, cell: (l) => <StatusMark status={l.status} /> },
    { key: "disbursed", head: "Disbursed", pri: 3, cell: (l) => day(l.disbursed_on) },
    ...(byOfficer ? [] : [{ key: "paid", head: "Instalments", pri: 3, cell: (l: Row) => <Instalments rows={pay.byLoan.get(n(l.id))} /> } satisfies Col<Row>]),
  ];
  return (
    <View label={label}>
      <ViewHead kicker={byOfficer ? "Loans" : "Loan history"} title={byOfficer ? label : `${plural(loans.length, "loan")} since ${day(loans.at(-1)!.disbursed_on).replace(/^\d+ /, "")}`} />
      <dl className="rv-stats rv-stats-strip">
        <div><dt>Borrowed</dt><dd>{taka(borrowed)}</dd><dd className="rv-note">{plural(loans.length, "loan")}</dd></div>
        <div><dt>Owed now</dt><dd>{b.outstanding ? taka(b.outstanding) : "Nothing"}</dd><dd className="rv-note">{b.active ? plural(b.active, "open loan") : "all repaid"}</dd></div>
        {byOfficer
          ? <div className={b.overdue ? "is-warn" : undefined}><dt>Overdue</dt><dd>{b.overdue ? plural(b.overdue, "loan") : "None"}</dd>{b.overdue ? <dd className="rv-note">{taka(b.overdueOutstanding)} at risk</dd> : null}</div>
          : <div className={paid.missed ? "is-warn" : undefined}><dt>Instalments</dt><dd>{pay.ready ? `${paid.onTime} of ${paid.total} on time` : "…"}</dd>{pay.ready && paid.total !== paid.onTime ? <dd className="rv-note">{[paid.late && plural(paid.late, "late"), paid.missed && `${paid.missed} missed`].filter(Boolean).join(", ")}</dd> : null}</div>}
      </dl>
      {overdue.length && !byOfficer ? (
        <p className="rv-alert" role="note"><AlertTriangle size={14} strokeWidth={2} aria-hidden />
          Cycle {String(overdue[0]!.cycle)} is overdue: {taka(overdue[0]!.outstanding_cents)} outstanding{pay.ready && paid.missed ? `, ${plural(paid.missed, "instalment")} missed` : ""}.
        </p>
      ) : null}
      <div className="rv-table-wrap">
        <Table label={label || "Loans"} rows={loans} rowKey={(l) => String(l.id)} cols={cols} rowAttrs={(l) => ({ "data-status": String(l.status) })}
          stack={(l) => [
            ...(byOfficer ? [[2, `Cycle ${l.cycle}`] as [2, string]] : []),
            [2, String(l.product)],
            [2, n(l.outstanding_cents) ? `${taka(l.outstanding_cents)} owed` : ""],
            [3, `Disbursed ${day(l.disbursed_on)}`],
          ]} />
      </div>
    </View>
  );
}

/* ---------- members, applications, groups ---------- */

function MemberList({ rows, label, open }: ListProps) {
  return (
    <View label={label}>
      <ViewHead kicker="Members" title={label} />
      <div className="rv-table-wrap">
        <Table label={label} rows={rows} rowKey={(m) => String(m.id)} stack={(m) => [[2, String(m.occupation)], [3, `Since ${day(m.joined_on)}`]]} cols={[
          { key: "name", head: "Name", pri: 1, cell: (m) => <RefLink to={recordRef("members", m.id)} open={open} name={String(m.name)}>{String(m.name)}</RefLink> },
          { key: "occupation", head: "Occupation", pri: 2, cell: (m) => String(m.occupation) },
          { key: "household", head: "Household", pri: 3, num: true, cell: (m) => String(m.household_size) },
          { key: "since", head: "Member since", pri: 3, cell: (m) => day(m.joined_on) },
          { key: "savings", head: "Savings", pri: 1, num: true, cell: (m) => taka(m.savings_cents) },
        ]} />
      </div>
    </View>
  );
}

function ApplicationList({ rows, column, label, open, paused }: ListProps) {
  const names = useMemberNames(paused);
  const byMember = column === "member_id";
  const current = useUi((x) => x.review?.item);
  return (
    <View label={label}>
      <ViewHead kicker="Applications" title={label} />
      <div className="rv-table-wrap">
        <Table label={label} rows={rows} rowKey={(a) => String(a.id)} rowAttrs={(a) => ({ "data-status": String(a.status) })}
          stack={(a) => [[2, `${a.product} · ${day(a.submitted_at)}`], [3, String(a.purpose)]]} cols={[
            { key: "app", head: byMember ? "Application" : "Borrower", pri: 1, cell: (a) => (
              <><RefLink to={recordRef("loan_applications", a.id)} open={open} name={`application ${a.id}`}>
                {byMember ? `#${a.id}` : names.get(n(a.member_id)) ?? `Member ${a.member_id}`}
              </RefLink>{n(a.id) === current ? <span className="rv-tag">In review</span> : null}</>) },
            { key: "product", head: "Product", pri: 2, cell: (a) => String(a.product) },
            { key: "purpose", head: "Purpose", pri: 3, cell: (a) => String(a.purpose) },
            { key: "amount", head: "Amount", pri: 1, num: true, cell: (a) => taka(a.amount_cents) },
            { key: "submitted", head: "Submitted", pri: 2, cell: (a) => day(a.submitted_at) },
            { key: "status", head: "Status", pri: 1, cell: (a) => <StatusMark status={a.status} /> },
          ]} />
      </div>
    </View>
  );
}

function GroupList({ rows, label, open }: ListProps) {
  return (
    <View label={label}>
      <ViewHead kicker="Lending groups" title={label} />
      <div className="rv-table-wrap">
        <Table label={label} rows={rows} rowKey={(g) => String(g.id)} stack={(g) => [[2, `Meets ${g.meeting_day}`]]} cols={[
          { key: "name", head: "Group", pri: 1, cell: (g) => <RefLink to={recordRef("lending_groups", g.id)} open={open} name={String(g.name)}>{String(g.name)}</RefLink> },
          { key: "village", head: "Village", pri: 1, cell: (g) => String(g.village) },
          { key: "meets", head: "Meets", pri: 2, cell: (g) => String(g.meeting_day) },
        ]} />
      </div>
    </View>
  );
}

const LISTS: Partial<Record<TableName, (p: ListProps) => React.ReactNode>> = {
  loans: LoanList, members: MemberList, loan_applications: ApplicationList, lending_groups: GroupList,
};
