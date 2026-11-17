import { registerPaneKind } from "../ui/pane-kinds";
import { registerProfile } from "../ui/profile";
import { overviewKind, reviewRecordKind, reviewRelatedKind } from "./kinds";
import { loanReview } from "./profile";

/** The loan-review workspace: its pane kinds and its profile. Call before boot, like registerAllPaneKinds. */
export function registerLoanReview(): void {
  registerPaneKind(overviewKind);
  // The review's views show the same objects as the record and related kinds: a link to one already on the page goes
  // to it, whichever kind the link names (pane-kinds.ts sameObject).
  registerPaneKind({ ...reviewRecordKind, object: "record" });
  registerPaneKind({ ...reviewRelatedKind, object: "related" });
  registerProfile(loanReview);
}
