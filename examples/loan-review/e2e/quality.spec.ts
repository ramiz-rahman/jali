/** The standard's checks on every view and in Split view, in both themes; the console guard runs in each test. */
import { qualitySuite } from "../../shared/e2e/quality";
import { openReview, VIEWS } from "./open";

qualitySuite({
  storage: "loan-review",
  axeKnown: [
    {
      rule: "region",
      target: ".jali-page-tabs",
      reason:
        "Jali renders a curated page's view tabs outside every landmark (loan-review/FINDINGS.md)",
    },
  ],
  layouts: [
    ...Object.entries(VIEWS).map(([tab, name]) => ({
      name,
      open: (page: Parameters<typeof openReview>[0]) => openReview(page, { tab }),
    })),
    { name: "Split view", open: (page) => openReview(page, { split: true }) },
  ],
});
