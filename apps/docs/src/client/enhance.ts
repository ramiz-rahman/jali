/**
 * The one script every page loads: it makes the static HTML work, with no framework. Each behaviour sits beside the
 * component whose HTML it works on (its `.client.ts`); this runs them all. Search loads its code the first time it is
 * opened; live parts hydrate as islands when they come near the screen (./islands.ts).
 */
import { initCodeTools } from "../shell/mdx/code.client";
import { initChoices } from "../shell/mdx/choice.client";
import { initInstallMenus } from "../shell/mdx/install.client";
import { initVideos } from "../shell/mdx/media.client";
import { initNavDrawer } from "../shell/nav-drawer.client";
import { initNotFound } from "../shell/not-found.client";
import { initCopyPage } from "../shell/page.client";
import { initSearch } from "../shell/search.client";
import { initTheme } from "../shell/theme.client";
import { initToc } from "../shell/toc.client";
import { initShowcase } from "../examples/showcase.client";
import { hydrateIslands } from "./islands";

initTheme();
initCodeTools();
initCopyPage();
initChoices();
initInstallMenus();
initToc();
initNavDrawer();
initSearch();
initVideos();
initNotFound();
initShowcase();
hydrateIslands();
