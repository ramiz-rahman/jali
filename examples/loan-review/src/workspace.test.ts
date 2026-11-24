/** Loan review's workspace: the page's views are the objects a reviewer's links name, whatever the link calls them. */
import { describe, expect, it } from "vite-plus/test";
import { createTestJali } from "jali-layout/testing";
import { reviewListKind } from "./kinds";
import type { Parties } from "./parties";
import { loanReviewOptions } from "./workspace";

const parties: Parties = (id) => ({ id, borrower: 1, property: 1, officer: 1 });

describe("Loan review's workspace", () => {
  it("goes to the open Mortgages view for a link that names the borrower's mortgages another way", () => {
    const { jali } = createTestJali(loanReviewOptions(parties));
    jali.page.setMode("split");
    const mortgages = jali.model().pane("mortgages");
    expect(mortgages?.ref.kind).toBe("review-related");
    // A link that calls them what Data Studio does: a related list is its rows, not its name.
    const link = reviewListKind({ ...mortgages!.ref.params, label: "Mortgages of this borrower" });
    expect(jali.model().paneOf(link)?.id).toBe("mortgages");
    expect(jali.model().paneOf(reviewListKind({ ...mortgages!.ref.params, value: -1 }))?.id).toBe(
      undefined,
    );
  });
});
