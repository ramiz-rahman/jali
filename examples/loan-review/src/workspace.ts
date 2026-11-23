/**
 * Loan review's workspace: one curated page and nothing else. With a page and no layout or presets, Jali opens the
 * page and stays in it, so there is no free workspace to leave to. It is made once the parties are read (parties.ts),
 * since the page binds its views from them.
 */
import { createJali, type Jali, type JaliOptions } from "jali";
import { defaultFeatures } from "jali/features";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { loanReviewKinds } from "./kinds";
import { chromeCommands } from "./page/chrome";
import type { Parties } from "./parties";
import { loanReviewPage } from "./page/definition";
import { startRole } from "./role";

/** What Loan review's workspace is made of, its page bound from `parties`. */
export const loanReviewOptions = (parties: Parties) =>
  ({
    panes: loanReviewKinds,
    page: loanReviewPage(parties),
    features: defaultFeatures(),
    commands: [...chromeCommands, makerCommand],
    name: "Loan review",
    storage: "loan-review",
    // The app is the whole page and has no <main> of its own: the panes are it.
    landmark: "main",
  }) satisfies JaliOptions;

/** The instance, for the persona the address names (role.tsx). */
export const createLoanReview = (parties: Parties): Jali =>
  createJali({ ...loanReviewOptions(parties), allow: startRole() });
