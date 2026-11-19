/** The page for an address with no page. */
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Lattice } from "./brand";

export function NotFound({ path }: { path: string }) {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <Lattice className="not-found-lattice" />
      <p className="page-eyebrow">404</p>
      <h1 className="page-title" id="not-found-title" tabIndex={-1} data-page-focus="">
        There is no page here
      </h1>
      <p className="page-summary">
        Nothing lives at <code className="inline-code">{path}</code>. It may have moved, or it may
        not be written yet.
      </p>
      <ul className="not-found-links">
        <li>
          <a href="/">
            Docs home
            <ArrowRightIcon aria-hidden size={15} />
          </a>
        </li>
        <li>
          <a href="/get-started/introduction">
            Introduction
            <ArrowRightIcon aria-hidden size={15} />
          </a>
        </li>
      </ul>
      <p className="not-found-hint">
        Or search: press <kbd className="kbd">/</kbd> anywhere.
      </p>
    </section>
  );
}
