/** The site: the page for the current path inside the layout. STUB: the shell agent owns this file. */
import { lazy, Suspense, useMemo } from "react";
import { MDXProvider } from "@mdx-js/react";
import { pages } from "../site/pages";
import { usePath, useLinkInterception } from "../site/router";
import { mdxComponents } from "./mdx";

export function App() {
  useLinkInterception();
  const path = usePath();
  const Page = useMemo(() => {
    const load = pages[path];
    return load ? lazy(async () => ({ default: (await load()).default })) : null;
  }, [path]);
  return (
    <MDXProvider components={mdxComponents}>
      <main className="docs-page">
        <Suspense fallback={null}>{Page ? <Page /> : <p>Not found: {path}</p>}</Suspense>
      </main>
    </MDXProvider>
  );
}
