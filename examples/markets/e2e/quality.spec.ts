/** The standard's checks on every desk, in both themes: axe and the width sweep; the console guard runs in each. */
import { qualitySuite } from "../../shared/e2e/quality";
import { openDesk } from "./open";

const DESKS = ["Equities", "Crypto", "Rates", "FX", "Compare"];

qualitySuite({
  storage: "markets",
  layouts: DESKS.map((name) => ({ name, open: (page) => openDesk(page, name) })),
});
