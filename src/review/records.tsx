/**
 * The loan-review record views: one designed view per table (application, member, group, field officer, loan), each in
 * plain words. Related records are links that open with the pane's own action: a peek in Single, beside in Split view.
 */
import {
  BriefcaseIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import type { PaneProps } from "@jali/react";
import { isLoading, useRecord, useRows } from "../data/hooks";
import type { TableName } from "../data/types";
import { applicationFacts } from "../data/sample-sql";
import { useActivity, useJaliState } from "@jali/react";
import { PaneGate } from "../panes/shared/PaneGate";
import { RecordPane } from "../panes/kinds/record";
import { day, taka } from "./page";
import {
  book,
  counted,
  instalments,
  latestLoans,
  plural,
  tenure,
  useAllMembers,
  useCount,
  useGroupStanding,
  useOfficerBook,
  useRepayments,
  type Row,
} from "./data";
import {
  Avatar,
  Facts,
  Instalments,
  listRef,
  recordRef,
  RefLink,
  Related,
  RelatedList,
  Sec,
  StatusMark,
  Table,
  View,
  ViewHead,
} from "./ui";

const n = (v: unknown) => Number(v ?? 0);
type Open = PaneProps["openBeside"];
const when = (v: unknown) => {
  const s = String(v ?? "");
  const time = /T(\d{2}:\d{2})/.exec(s)?.[1];
  return time ? `${day(v)}, ${time}` : day(v);
};

/** One record of any loan-book table; tables without a designed view fall back to the Data Studio record. */
export function ReviewRecordPane(p: PaneProps<{ table: string; id?: string | number }>) {
  const table = (p.params.table ?? "") as TableName;
  const id = String(p.params.id ?? "");
  const designed = table in VIEWS;
  const rec = useRecord(table, id, { paused: p.paused || !designed });
  useActivity(designed ? (isLoading(rec) ? "loading" : rec.isError ? "error" : "idle") : undefined);
  if (!designed) return <RecordPane {...p} />;
  if (isLoading(rec) || rec.isError || !rec.data)
    return (
      <PaneGate
        queries={[rec]}
        gone={`${NOUN[table] ?? "Record"} ${id}`}
        onRetry={() => {
          void rec.refetch();
        }}
      />
    );
  const V = VIEWS[table]!;
  return <V row={rec.data} open={p.openBeside} paused={p.paused} />;
}

type ViewProps = { row: Row; open: Open; paused: boolean };
const NOUN: Partial<Record<TableName, string>> = {
  loan_applications: "Application",
  members: "Member",
  lending_groups: "Group",
  field_officers: "Field officer",
  loans: "Loan",
};

/* ---------- application ---------- */

function ApplicationView({ row: app, open, paused }: ViewProps) {
  const member = useRecord("members", String(app.member_id), { paused }).data;
  const group = useRecord("lending_groups", String(app.group_id), { paused }).data;
  const officer = useRecord("field_officers", String(app.field_officer_id), { paused }).data;
  const loans = useRows(
    "loans",
    { where: { member_id: n(app.member_id) }, orderBy: "cycle DESC", limit: 20 },
    { paused },
  ).data?.rows;
  const apps = useCount("loan_applications", { member_id: n(app.member_id) }, paused);
  const weekly = n(app.amount_cents) / Math.max(1, n(app.term_weeks));
  return (
    <View label="Application">
      <ViewHead
        kicker={
          <>
            Application <span className="rv-num">#{String(app.id)}</span> · {String(app.product)}
          </>
        }
        title={String(app.purpose)}
        status={app.status}
      />
      <div className="rv-body">
        <div className="rv-main">
          <Sec title="Terms">
            <Facts
              rows={[
                ["Amount", taka(app.amount_cents)],
                ["Term", `${app.term_weeks} weeks`],
                ["Weekly instalment", taka(weekly)],
                ["Product", String(app.product)],
                ["Submitted", when(app.submitted_at)],
              ]}
            />
          </Sec>
          <Sec title="Against earlier loans">
            {loans ? (
              <Ladder loans={loans} request={n(app.amount_cents)} />
            ) : (
              <span className="rv-muted">…</span>
            )}
          </Sec>
        </div>
        <aside className="rv-side">
          <Sec title="People">
            <RelatedList>
              <Related
                open={open}
                to={recordRef("members", app.member_id)}
                name={member ? String(member.name) : "the borrower"}
                icon={<Avatar name={member?.name} />}
                label={member ? String(member.name) : "Borrower"}
                note={member ? `Borrower · ${member.occupation}` : "Borrower"}
              />
              <Related
                open={open}
                to={recordRef("lending_groups", app.group_id)}
                name={group ? String(group.name) : "the group"}
                icon={<UsersIcon size={15} />}
                label={group ? String(group.name) : "Group"}
                note={group ? `Group · ${group.village}` : "Group"}
              />
              <Related
                open={open}
                to={recordRef("field_officers", app.field_officer_id)}
                name={officer ? String(officer.name) : "the field officer"}
                icon={<BriefcaseIcon size={15} />}
                label={officer ? String(officer.name) : "Field officer"}
                note={officer ? `Field officer · ${officer.branch}` : "Field officer"}
              />
            </RelatedList>
          </Sec>
          <Sec title="Also on file">
            <RelatedList>
              <Related
                open={open}
                name="loan history"
                to={
                  loans?.length
                    ? listRef("loans", "member_id", app.member_id, "Loan history")
                    : undefined
                }
                icon={<ClockCounterClockwiseIcon size={15} />}
                label={loans ? counted(loans.length, "earlier loan") : "Earlier loans"}
                note={
                  loans?.length
                    ? `${book(loans).active ? `${taka(book(loans).outstanding)} owed` : "all repaid"}`
                    : undefined
                }
              />
              <Related
                open={open}
                name="other applications"
                to={
                  apps && apps > 1
                    ? listRef(
                        "loan_applications",
                        "member_id",
                        app.member_id,
                        member ? `Applications by ${member.name}` : "Applications",
                      )
                    : undefined
                }
                icon={<FileTextIcon size={15} />}
                label={
                  apps === undefined ? "Other applications" : counted(apps - 1, "other application")
                }
              />
            </RelatedList>
          </Sec>
        </aside>
      </div>
    </View>
  );
}

/** Each earlier loan's principal beside this request, as bars on one scale: how big a step this is. */
export function Ladder({ loans, request }: { loans: Row[]; request: number }) {
  const steps = [...loans]
    .sort((a, b) => n(a.cycle) - n(b.cycle))
    .map((l) => ({
      key: `c${l.cycle}`,
      label: `Cycle ${l.cycle}`,
      cents: n(l.principal_cents),
      status: String(l.status),
    }));
  const all = [...steps, { key: "now", label: "This request", cents: request, status: "request" }];
  const max = Math.max(...all.map((s) => s.cents));
  const last = steps.at(-1);
  return (
    <div className="rv-ladder">
      <ol aria-label="Principal by cycle, then this request">
        {all.map((s) => (
          <li key={s.key} data-status={s.status}>
            <span className="rv-ladder-label">{s.label}</span>
            <span className="rv-ladder-track">
              <span className="rv-ladder-bar" style={{ width: `${(s.cents / max) * 100}%` }} />
            </span>
            <span className="rv-ladder-val">{taka(s.cents)}</span>
          </li>
        ))}
      </ol>
      <p className="rv-ladder-note">
        {last ? stepWords(request, last.cents) : "First loan with us: no earlier loans to compare."}
      </p>
    </div>
  );
}
const stepWords = (now: number, before: number) => {
  const pct = Math.round((now / before - 1) * 100);
  return pct === 0
    ? "The same as the last loan."
    : pct > 0
      ? `${taka(now - before)} more than the last loan (+${pct}%).`
      : `${taka(before - now)} less than the last loan (${pct}%).`;
};

/* ---------- borrower ---------- */

function BorrowerView({ row: m, open, paused }: ViewProps) {
  const group = useRecord("lending_groups", String(m.group_id), { paused }).data;
  const officer = useRecord("field_officers", String(group?.field_officer_id ?? ""), {
    paused: paused || !group,
  }).data;
  const loans = useRows(
    "loans",
    { where: { member_id: n(m.id) }, orderBy: "cycle DESC", limit: 20 },
    { paused },
  ).data?.rows;
  const apps = useCount("loan_applications", { member_id: n(m.id) }, paused);
  const groupSize = useCount("members", { group_id: n(m.group_id) }, paused);
  const pay = useRepayments(
    (loans ?? []).map((l) => n(l.id)),
    paused,
  );
  const all = [...pay.byLoan.values()].flat();
  const paid = instalments(all);
  const b = loans ? book(loans) : undefined;
  const latest = useRows(
    "loan_applications",
    { where: { member_id: n(m.id) }, orderBy: "submitted_at DESC", limit: 1 },
    { paused },
  ).data?.rows[0];
  return (
    <View label="Borrower">
      <ViewHead
        kicker={
          <>
            Member <span className="rv-num">#{String(m.id)}</span>
            {group ? ` · ${group.name}` : ""}
          </>
        }
        title={String(m.name)}
      >
        {String(m.occupation)} · household of {String(m.household_size)}
      </ViewHead>
      <div className="rv-body">
        <div className="rv-main">
          <Sec title="Member">
            <Facts
              rows={[
                ["Occupation", String(m.occupation)],
                ["Household", `${m.household_size} people`],
                [
                  "Member since",
                  day(m.joined_on),
                  latest ? tenure(m.joined_on, latest.submitted_at) : undefined,
                ],
                ["Savings", taka(m.savings_cents)],
              ]}
            />
          </Sec>
          <Sec title="Record with us">
            <Facts
              rows={[
                [
                  "Loans",
                  b ? (b.loans ? `${b.loans} · ${b.loans - b.active} repaid` : "None yet") : "…",
                ],
                [
                  "Owed now",
                  b ? (b.outstanding ? taka(b.outstanding) : "Nothing") : "…",
                  b?.overdue ? <span className="rv-warn">{b.overdue} overdue</span> : undefined,
                ],
                [
                  "Instalments",
                  pay.ready && all.length
                    ? `${paid.onTime} of ${paid.total} on time`
                    : b && !b.loans
                      ? "No record yet"
                      : "…",
                  pay.ready && all.length ? <Instalments rows={all} /> : undefined,
                ],
              ]}
            />
          </Sec>
        </div>
        <aside className="rv-side">
          <Sec title="Group and officer">
            <RelatedList>
              <Related
                open={open}
                to={recordRef("lending_groups", m.group_id)}
                name={group ? String(group.name) : "the group"}
                icon={<UsersIcon size={15} />}
                label={group ? String(group.name) : "Group"}
                note={group ? `${group.village} · meets ${group.meeting_day}` : undefined}
              />
              {group ? (
                <Related
                  open={open}
                  to={recordRef("field_officers", group.field_officer_id)}
                  name={officer ? String(officer.name) : "the field officer"}
                  icon={<BriefcaseIcon size={15} />}
                  label={officer ? String(officer.name) : "Field officer"}
                  note={officer ? `Field officer · ${officer.branch}` : undefined}
                />
              ) : null}
            </RelatedList>
          </Sec>
          <Sec title="Also on file">
            <RelatedList>
              <Related
                open={open}
                name="loan history"
                to={loans?.length ? listRef("loans", "member_id", m.id, "Loan history") : undefined}
                icon={<ClockCounterClockwiseIcon size={15} />}
                label={loans ? counted(loans.length, "loan") : "Loans"}
                note={b?.active ? `${taka(b.outstanding)} owed` : undefined}
              />
              <Related
                open={open}
                name="applications"
                to={
                  apps
                    ? listRef("loan_applications", "member_id", m.id, `Applications by ${m.name}`)
                    : undefined
                }
                icon={<FileTextIcon size={15} />}
                label={apps === undefined ? "Applications" : counted(apps, "application")}
              />
              <Related
                open={open}
                name="group members"
                to={
                  groupSize
                    ? listRef(
                        "members",
                        "group_id",
                        m.group_id,
                        group ? `Members of ${group.name}` : "Group members",
                      )
                    : undefined
                }
                icon={<UserIcon size={15} />}
                label={
                  groupSize === undefined ? "Group members" : counted(groupSize - 1, "other member")
                }
                note={group ? `in ${group.name}` : undefined}
              />
            </RelatedList>
          </Sec>
        </aside>
      </div>
    </View>
  );
}

/* ---------- group ---------- */

function GroupView({ row: g, open, paused }: ViewProps) {
  const officer = useRecord("field_officers", String(g.field_officer_id), { paused }).data;
  const { members, loans, standing: s } = useGroupStanding(g, paused);
  const latest = loans ? latestLoans(loans) : undefined;
  const applicant = useJaliState((x) =>
    x.page ? applicationFacts(Number(x.page.item)).member : undefined,
  );
  const apps = useCount("loan_applications", { group_id: n(g.id) }, paused);
  return (
    <View label="Group">
      <ViewHead kicker="Lending group" title={String(g.name)}>
        {String(g.village)} · meets every {String(g.meeting_day)}
      </ViewHead>
      <div className="rv-body">
        <div className="rv-main">
          <Sec title="Group">
            <Facts
              rows={[
                ["Village", String(g.village)],
                ["Meets", `Every ${g.meeting_day}`],
                ["Members", members ? String(members.length) : "…"],
              ]}
            />
          </Sec>
          <Sec title="Standing">
            {s ? <Standing s={s} members={members?.length} /> : <span className="rv-muted">…</span>}
          </Sec>
          <Sec title="Members">
            {members && latest ? (
              <Table
                label="Members and their current loans"
                rows={members}
                rowKey={(m) => String(m.id)}
                rowAttrs={(m) => ({ "data-status": String(latest.get(n(m.id))?.status ?? "none") })}
                stack={(m) => [[2, String(m.occupation)]]}
                cols={[
                  {
                    key: "name",
                    head: "Member",
                    pri: 1,
                    cell: (m) => (
                      <>
                        <RefLink to={recordRef("members", m.id)} open={open} name={String(m.name)}>
                          {String(m.name)}
                        </RefLink>{" "}
                        <span className="rv-muted rv-num">#{String(m.id)}</span>
                        {n(m.id) === applicant ? <span className="rv-tag">Applicant</span> : null}
                      </>
                    ),
                  },
                  { key: "job", head: "Occupation", pri: 2, cell: (m) => String(m.occupation) },
                  {
                    key: "owed",
                    head: "Owed",
                    pri: 1,
                    num: true,
                    cell: (m) => {
                      const l = latest.get(n(m.id));
                      return l && n(l.outstanding_cents) ? (
                        taka(l.outstanding_cents)
                      ) : (
                        <span className="rv-muted">–</span>
                      );
                    },
                  },
                  {
                    key: "loan",
                    head: "Latest loan",
                    pri: 1,
                    cell: (m) => {
                      const l = latest.get(n(m.id));
                      return l ? (
                        <StatusMark status={l.status} />
                      ) : (
                        <span className="rv-muted">None</span>
                      );
                    },
                  },
                ]}
              />
            ) : (
              <span className="rv-muted">…</span>
            )}
          </Sec>
        </div>
        <aside className="rv-side">
          <Sec title="Field officer">
            <RelatedList>
              <Related
                open={open}
                to={recordRef("field_officers", g.field_officer_id)}
                name={officer ? String(officer.name) : "the field officer"}
                icon={<Avatar name={officer?.name} />}
                label={officer ? String(officer.name) : "Field officer"}
                note={officer ? `${officer.branch} branch` : undefined}
              />
            </RelatedList>
          </Sec>
          <Sec title="In this group">
            <RelatedList>
              <Related
                open={open}
                name="members"
                to={
                  members?.length
                    ? listRef("members", "group_id", g.id, `Members of ${g.name}`)
                    : undefined
                }
                icon={<UserIcon size={15} />}
                label={members ? counted(members.length, "member") : "Members"}
              />
              <Related
                open={open}
                name="applications"
                to={
                  apps
                    ? listRef("loan_applications", "group_id", g.id, `Applications from ${g.name}`)
                    : undefined
                }
                icon={<FileTextIcon size={15} />}
                label={apps === undefined ? "Applications" : counted(apps, "application")}
              />
            </RelatedList>
          </Sec>
        </aside>
      </div>
    </View>
  );
}

/** A book of loans in a few numbers; overdue in the warning colour. */
export function Standing({
  s,
  members,
  groups,
}: {
  s: ReturnType<typeof book>;
  members?: number;
  groups?: number;
}) {
  return (
    <dl className="rv-stats">
      {groups !== undefined ? (
        <div>
          <dt>Groups</dt>
          <dd>{groups}</dd>
        </div>
      ) : null}
      <div>
        <dt>Active loans</dt>
        <dd>{s.active}</dd>
        {members ? (
          <dd className="rv-note">
            {s.borrowers === members
              ? "every member borrowing"
              : `${s.borrowers} of ${members} members`}
          </dd>
        ) : s.borrowers !== s.active ? (
          <dd className="rv-note">{plural(s.borrowers, "borrower")}</dd>
        ) : null}
      </div>
      <div>
        <dt>Owed</dt>
        <dd>{taka(s.outstanding)}</dd>
      </div>
      <div className={s.overdue ? "is-warn" : undefined}>
        <dt>Overdue</dt>
        <dd>{s.overdue ? plural(s.overdue, "loan") : "None"}</dd>
        {s.overdue ? <dd className="rv-note">{taka(s.overdueOutstanding)} at risk</dd> : null}
      </div>
    </dl>
  );
}

/* ---------- field officer ---------- */

function OfficerView({ row: o, open, paused }: ViewProps) {
  const { loans, groups } = useOfficerBook(n(o.id), paused);
  const everyone = useAllMembers(paused);
  const perGroup = (gid: unknown) => {
    const ids = new Set(
      (everyone ?? []).filter((m) => n(m.group_id) === n(gid)).map((m) => n(m.id)),
    );
    return { members: ids.size, ...book((loans ?? []).filter((l) => ids.has(n(l.member_id)))) };
  };
  const apps = useCount("loan_applications", { field_officer_id: n(o.id) }, paused);
  const s = loans ? book(loans) : undefined;
  return (
    <View label="Field officer">
      <ViewHead kicker={`Field officer · ${o.branch} branch`} title={String(o.name)}>
        <a className="rv-tel" href={`tel:${String(o.phone).replace(/\D/g, "")}`}>
          <PhoneIcon size={12} aria-hidden /> {String(o.phone)}
        </a>
      </ViewHead>
      <div className="rv-body">
        <div className="rv-main">
          <Sec title="Officer">
            <Facts
              rows={[
                ["Branch", String(o.branch)],
                ["Phone", String(o.phone)],
                ["Groups", groups ? String(groups.length) : "…"],
              ]}
            />
          </Sec>
          <Sec title="Caseload">{s ? <Standing s={s} /> : <span className="rv-muted">…</span>}</Sec>
          <Sec title="Groups">
            {groups && loans && everyone ? (
              <Table
                label="Groups and how they stand"
                rows={groups.map((g) => ({ g, s: perGroup(g.id) }))}
                rowKey={(r) => String(r.g.id)}
                rowAttrs={(r) => ({ "data-status": r.s.overdue ? "overdue" : "active" })}
                stack={(r) => [[2, `${r.g.village} · ${r.g.meeting_day}`]]}
                cols={[
                  {
                    key: "name",
                    head: "Group",
                    pri: 1,
                    cell: (r) => (
                      <RefLink
                        to={recordRef("lending_groups", r.g.id)}
                        open={open}
                        name={String(r.g.name)}
                      >
                        {String(r.g.name)}
                      </RefLink>
                    ),
                  },
                  { key: "village", head: "Village", pri: 2, cell: (r) => String(r.g.village) },
                  { key: "meets", head: "Meets", pri: 3, cell: (r) => String(r.g.meeting_day) },
                  {
                    key: "members",
                    head: "Members",
                    pri: 3,
                    num: true,
                    cell: (r) => String(r.s.members),
                  },
                  {
                    key: "active",
                    head: "Active loans",
                    pri: 1,
                    num: true,
                    cell: (r) => String(r.s.active),
                  },
                  {
                    key: "owed",
                    head: "Owed",
                    pri: 2,
                    num: true,
                    cell: (r) => taka(r.s.outstanding),
                  },
                  {
                    key: "overdue",
                    head: "Overdue",
                    pri: 1,
                    num: true,
                    cell: (r) =>
                      r.s.overdue ? (
                        <span className="rv-warn">{r.s.overdue}</span>
                      ) : (
                        <span className="rv-muted">–</span>
                      ),
                  },
                ]}
              />
            ) : (
              <span className="rv-muted">…</span>
            )}
          </Sec>
        </div>
        <aside className="rv-side">
          <Sec title="Looks after">
            <RelatedList>
              <Related
                open={open}
                name="groups"
                to={
                  groups?.length
                    ? listRef("lending_groups", "field_officer_id", o.id, `Groups of ${o.name}`)
                    : undefined
                }
                icon={<UsersIcon size={15} />}
                label={groups ? counted(groups.length, "group") : "Groups"}
                note={groups
                  ?.slice(0, 3)
                  .map((g) => g.name)
                  .join(", ")}
              />
              <Related
                open={open}
                name="loans"
                to={
                  loans?.length
                    ? listRef("loans", "field_officer_id", o.id, `Loans of ${o.name}`)
                    : undefined
                }
                icon={<ClockCounterClockwiseIcon size={15} />}
                label={s ? counted(s.active, "active loan") : "Loans"}
                note={s ? `${s.loans} in all` : undefined}
              />
              <Related
                open={open}
                name="applications"
                to={
                  apps
                    ? listRef(
                        "loan_applications",
                        "field_officer_id",
                        o.id,
                        `Applications through ${o.name}`,
                      )
                    : undefined
                }
                icon={<FileTextIcon size={15} />}
                label={apps === undefined ? "Applications" : counted(apps, "application")}
              />
            </RelatedList>
          </Sec>
        </aside>
      </div>
    </View>
  );
}

/* ---------- loan ---------- */

function LoanView({ row: l, open, paused }: ViewProps) {
  const member = useRecord("members", String(l.member_id), { paused }).data;
  const officer = useRecord("field_officers", String(l.field_officer_id), { paused }).data;
  const pay = useRepayments([n(l.id)], paused);
  const rows = pay.byLoan.get(n(l.id));
  return (
    <View label="Loan">
      <ViewHead
        kicker={
          <>
            Loan <span className="rv-num">#{String(l.id)}</span> · cycle {String(l.cycle)}
          </>
        }
        title={`${taka(l.principal_cents)} · ${l.product}`}
        status={l.status}
      />
      <div className="rv-body">
        <div className="rv-main">
          <Sec title="Loan">
            <Facts
              rows={[
                ["Principal", taka(l.principal_cents)],
                ["Outstanding", n(l.outstanding_cents) ? taka(l.outstanding_cents) : "Nothing"],
                ["Product", String(l.product)],
                ["Cycle", String(l.cycle)],
                ["Disbursed", day(l.disbursed_on)],
              ]}
            />
          </Sec>
          <Sec title="Instalments" aside={rows ? <Instalments rows={rows} /> : undefined}>
            {rows ? (
              <Table
                label="Instalments"
                rows={rows}
                rowKey={(r) => String(r.id)}
                rowAttrs={(r) => ({ "data-status": String(r.status) })}
                cols={[
                  { key: "due", head: "Due", pri: 1, cell: (r) => day(r.due_on) },
                  {
                    key: "amount",
                    head: "Amount",
                    pri: 1,
                    num: true,
                    cell: (r) => taka(r.amount_cents),
                  },
                  {
                    key: "status",
                    head: "Status",
                    pri: 1,
                    cell: (r) => <StatusMark status={r.status} />,
                  },
                  {
                    key: "paid",
                    head: "Paid",
                    pri: 2,
                    cell: (r) => (r.paid_on ? day(r.paid_on) : "–"),
                  },
                ]}
              />
            ) : (
              <span className="rv-muted">…</span>
            )}
          </Sec>
        </div>
        <aside className="rv-side">
          <Sec title="People">
            <RelatedList>
              <Related
                open={open}
                to={recordRef("members", l.member_id)}
                name={member ? String(member.name) : "the borrower"}
                icon={<Avatar name={member?.name} />}
                label={member ? String(member.name) : "Borrower"}
                note="Borrower"
              />
              <Related
                open={open}
                to={recordRef("field_officers", l.field_officer_id)}
                name={officer ? String(officer.name) : "the field officer"}
                icon={<BriefcaseIcon size={15} />}
                label={officer ? String(officer.name) : "Field officer"}
                note="Field officer"
              />
            </RelatedList>
          </Sec>
        </aside>
      </div>
    </View>
  );
}

const VIEWS: Partial<Record<TableName, (p: ViewProps) => React.ReactNode>> = {
  loan_applications: ApplicationView,
  members: BorrowerView,
  lending_groups: GroupView,
  field_officers: OfficerView,
  loans: LoanView,
};
