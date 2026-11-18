import type { PaneKindDef } from "../ui/define";
import { overviewKind, reviewRecordKind, reviewRelatedKind } from "./kinds";
import { loanReview } from "./profile";

/**
 * The loan-review workspace's pane kinds. Its views show the same objects as the record and related kinds: a link to
 * one already on the page goes to it, whichever kind the link names (PaneKinds.sameObject).
 */
export const loanReviewKinds: readonly PaneKindDef[] = [
  overviewKind,
  { ...reviewRecordKind, object: "record" },
  { ...reviewRelatedKind, object: "related" },
];

export { loanReview };
