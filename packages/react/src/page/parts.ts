/**
 * A curated page's React parts: its view (rail, header, tabs and panes), the ⌥ preview over the panes and its settings.
 * `definePage` puts them on the page, so an app without a page ships none of them. The bar (`<PageBar>`) is the host's
 * to place. The contract they meet is contract.ts.
 */
import type { PageParts } from "./contract";
import { CuratedPage } from "./CuratedPage";
import { Ghost } from "./Ghost";
import { PageSettings } from "./PageSettings";

export const pageParts: PageParts = { View: CuratedPage, Ghost, Settings: PageSettings };
