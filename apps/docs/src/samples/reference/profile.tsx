import { FileText, User } from "lucide-react";
import type { WorkspaceProfile } from "@jali/react";

// A curated page about one loan application: two views, a queue at the left and a header over the tabs.
export const loanReview: WorkspaceProfile = {
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
  bind: (item) => ({
    borrower: { kind: "borrower", params: { application: item } },
    documents: { kind: "documents", params: { application: item } },
  }),
  build: (item) => ({
    version: 1,
    root: {
      id: "root", type: "row", size: { weight: 1 }, children: [
        { id: "borrower", type: "pane", role: "borrower", priority: "primary", size: { weight: 1 }, ref: { kind: "borrower", params: { application: item } } },
        { id: "documents", type: "pane", role: "documents", priority: "supporting", size: { weight: 1 }, ref: { kind: "documents", params: { application: item } } },
      ],
    },
  }),
  Rail: ({ item, activate }) => (
    <nav aria-label="Applications">
      {[1, 2, 3].map((n) => <button key={n} aria-current={n === item} onClick={() => activate(n)}>Application {n}</button>)}
    </nav>
  ),
  Header: ({ item }) => <h1>Application {item}</h1>,
};
