/**
 * Loan review: reads who each application is for from the sample database, then makes the workspace (its page binds
 * views from those parties) and mounts it.
 */
import { createDataLayer } from "@jali-examples/shared/data";
import { start } from "@jali-examples/shared/start";
import { loadParties } from "./parties";
import { createLoanReview, loanReviewOptions } from "./workspace";
// Loan review's styles, in cascade order, after the shared shell's and panes' (which the imports above bring): the
// page around the views, the parts the views share, Overview's grid. Then its face, Be Vietnam Pro (Fontsource, SIL
// Open Font License), and its theme, last so it wins over the shared shell's tokens (theme.css says why).
import "./page/queue/queue.css";
import "./page/header.css";
import "./views/parts/layout.css";
import "./views/parts/links.css";
import "./views/parts/marks.css";
import "./views/parts/figures.css";
import "./views/overview/overview.css";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-500.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "./theme.css";

const data = createDataLayer();
void loadParties(data.api).then((parties) => {
  const options = loanReviewOptions(parties);
  start(createLoanReview(parties), { name: options.name, itemNoun: options.page.itemNoun }, data);
});
