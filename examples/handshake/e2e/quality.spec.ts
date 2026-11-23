/** The standard's checks on every layout, in both themes: axe and the width sweep; the console guard runs in each. */
import { qualitySuite } from "../../shared/e2e/quality";
import { openLayout } from "./open";

const LAYOUTS = ["Course", "Packet lab", "Connection", "Home network"];

qualitySuite({
  storage: "handshake",
  layouts: LAYOUTS.map((name) => ({ name, open: (page) => openLayout(page, name) })),
  axeExclude: [
    // An open branch of CyberSpec's Tree (the packet's dissection): the ARIA tree pattern nests a branch's children
    // inside its treeitem, and axe's label-content-name-mismatch then counts their text as the branch's visible
    // label. Recorded in FINDINGS.md (Packets).
    '[data-kit="tree-item"][aria-expanded="true"]',
  ],
});
