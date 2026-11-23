/**
 * Loan review: an underwriter works through a queue of home loan applications (purchases, refinances, HELOCs). Each
 * application is one page: a header, then tabs (nav/roles.ts). Split view starts from Overview's sections as panes: the
 * application, with the borrower and their mortgages beside.
 */
import { column, pane, row, type ObjectRef } from "jali";
import { definePage } from "jali/page";
import type { Parties } from "../parties";
import { PAGE_VIEWS, ROLES, type Role } from "../nav/roles";
import { ApplicationHeader } from "./header";
import { QueueRail } from "./queue/rail";

/**
 * The page, bound from the parties read before it opens (parties.ts): what each view shows for an application is its
 * own record, and the borrower, property and loan officer the database says it is for. An application the database
 * doesn't have (a stale link) binds its views to nothing that exists, so each says it can't be found.
 */
export function loanReviewPage(partiesOf: Parties) {
  function bind(item: number): Record<Role, ObjectRef> {
    const parties = partiesOf(item);
    return Object.fromEntries(
      Object.entries(ROLES).map(([role, { party, ref }]) => [role, ref(parties[party])]),
    ) as Record<Role, ObjectRef>;
  }

  /** Split view's starting layout: every view is in it; Overview, Property and Loan officer start hidden. */
  function build(item: number) {
    const refs = bind(item);
    const view = (role: Role, options: { weight?: number; hidden?: boolean } = {}) =>
      pane(refs[role], { id: role, role, priority: ROLES[role].priority, ...options });
    return row(
      { id: "arrangement" },
      view("overview", { hidden: true }),
      view("application", { weight: 1.15 }),
      column({ id: "context" }, view("borrower"), view("mortgages")),
      column(
        { id: "network", weight: 0.85 },
        view("property", { hidden: true }),
        view("officer", { hidden: true }),
      ),
    );
  }

  return definePage({
    id: "loan-review",
    name: "Loan review",
    itemNoun: "application",
    roles: PAGE_VIEWS,
    home: "overview",
    build,
    bind,
    firstItem: 1,
    Rail: QueueRail,
    Header: ApplicationHeader,
  });
}
