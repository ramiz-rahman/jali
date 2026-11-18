import { FileText, User } from "lucide-react";
import { pane, row } from "@jali/core";
import { definePage, definePane } from "@jali/react";

const borrower = definePane("borrower", {
  params: { application: Number },
  title: "Borrower",
  Component: () => null,
});
const documents = definePane("documents", {
  params: { application: Number },
  title: "Documents",
  Component: () => null,
});

// A curated page about one loan application: two views, a queue at the left and a header over the tabs.
export const loanReview = definePage({
  id: "loan-review",
  name: "Loan review",
  itemNoun: "application",
  viewers: { full: "credit reviewer", limited: "loan officer" },
  roles: [
    { id: "borrower", label: "Borrower", priority: "primary", icon: User },
    { id: "documents", label: "Documents", priority: "supporting", icon: FileText },
  ],
  home: "borrower",
  firstItem: 1,
  // What each view shows for an application.
  bind: (item) => ({
    borrower: borrower({ application: item }),
    documents: documents({ application: item }),
  }),
  // Multiplexed mode's designed layout. A view's pane has the view's id as its id and its role.
  build: (item) =>
    row(
      pane(borrower({ application: item }), {
        id: "borrower",
        role: "borrower",
        priority: "primary",
      }),
      pane(documents({ application: item }), {
        id: "documents",
        role: "documents",
        priority: "supporting",
      }),
    ),
  Rail: ({ item, activate }) => (
    <nav aria-label="Applications">
      {[1, 2, 3].map((n) => (
        <button key={n} aria-current={n === item} onClick={() => activate(n)}>
          Application {n}
        </button>
      ))}
    </nav>
  ),
  Header: ({ item }) => <h1>Application {item}</h1>,
});
