/**
 * Loan review's workspace: one curated page and nothing else. With a page and no layout or presets, Jali opens the
 * page and stays in it, so there is no free workspace to leave to.
 */
import { createJali, type Jali, type JaliOptions } from "jali";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { loanReview, loanReviewKinds } from "./review";
import { defaultFeatures } from "jali/features";
import { startRole } from "./role";

/** What Loan review's workspace is made of. */
export const loanReviewOptions = {
  panes: loanReviewKinds,
  page: loanReview,
  features: defaultFeatures(),
  commands: [makerCommand],
  name: "Loan review",
  storage: "loan-review",
  // The app is the whole page and has no <main> of its own: the panes are it.
  landmark: "main",
} satisfies JaliOptions;

/** The instance, for the persona the address names (role.tsx). */
export const createLoanReview = (): Jali =>
  createJali({ ...loanReviewOptions, allow: startRole() });
