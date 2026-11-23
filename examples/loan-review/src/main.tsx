/**
 * Loan review: reads who each application is for from the sample database, then makes the workspace (its page binds
 * views from those facts) and mounts it.
 */
import { createDataLayer } from "@jali-examples/shared/data";
import { start } from "@jali-examples/shared/start";
import { loadFacts } from "./review/facts";
import { loanReview } from "./review";
import { createLoanReview, loanReviewOptions } from "./workspace";

const data = createDataLayer();
void loadFacts(data.api).then(() =>
  start(createLoanReview(), { name: loanReviewOptions.name, itemNoun: loanReview.itemNoun }, data),
);
