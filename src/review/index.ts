import { registerPaneKind } from "../ui/pane-kinds";
import { registerProfile } from "../ui/profile";
import { queueKind, reviewRecordKind, reviewRelatedKind } from "./kinds";
import { loanReview } from "./profile";

/** The loan-review workspace: its pane kinds and its profile. Call before boot, like registerAllPaneKinds. */
export function registerLoanReview(): void {
  registerPaneKind(queueKind);
  registerPaneKind(reviewRecordKind);
  registerPaneKind(reviewRelatedKind);
  registerProfile(loanReview);
}
