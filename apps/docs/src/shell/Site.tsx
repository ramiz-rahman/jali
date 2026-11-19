/**
 * The island Astro prerenders and hydrates on every page. Before hydrating, the browser loads the page's own module
 * (top-level await), so the first client render matches the prerendered HTML.
 */
import { App, seedPage } from "./App";
import { pages } from "../site/pages";
import { InitialPath, currentPath } from "../site/router";
import "@jali/react/styles.css";
import "../styles/site.css";

if (typeof window !== "undefined") {
  const path = currentPath();
  const load = pages[path];
  if (load) {
    try {
      seedPage(path, await load());
    } catch {
      /* the app loads it again, or shows Not found */
    }
  }
}

export default function Site({ path }: { path: string }) {
  return (
    <InitialPath.Provider value={path}>
      <App />
    </InitialPath.Provider>
  );
}
