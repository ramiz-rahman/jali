/** Loan review's workspace: the page's views are the objects a reviewer's links name, whatever the link calls them. */
import { describe, expect, it } from "vite-plus/test";
import { createTestJali } from "jali/testing";
import { reviewRelatedKind } from "./review/kinds";
import { loanReviewOptions } from "./workspace";

describe("Loan review's workspace", () => {
  it("goes to the open Loan history for a link that names the member's loans another way", () => {
    const { jali } = createTestJali(loanReviewOptions);
    jali.page.setMode("split");
    const history = jali.model().panes.find((p) => p.ref.kind === "review-related");
    expect(history?.title).toBe("Loan history");
    // A link that calls them what Data Studio does: a related list is its rows, not its name.
    const link = reviewRelatedKind({ ...history!.ref.params, label: "Loans by this member" });
    expect(jali.model().paneOf(link)?.id).toBe(history!.id);
    expect(
      jali.model().paneOf(reviewRelatedKind({ ...history!.ref.params, value: -1 }))?.id,
    ).toBeUndefined();
  });
});
