import type { Pane } from "jali/react";
import { overviewKind, reviewRecordKind, reviewRelatedKind } from "./kinds";
import { loanReview } from "./profile";

/** The loan-review workspace's pane kinds. */
export const loanReviewKinds: readonly Pane[] = [overviewKind, reviewRecordKind, reviewRelatedKind];

export { loanReview };
