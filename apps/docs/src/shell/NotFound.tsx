/** The page for an address with no page: the 404 file hosts serve for any unknown address. */
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Lattice } from "./brand";

export function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <Lattice className="not-found-lattice" />
      <p className="page-eyebrow">404</p>
      <h1 className="page-title" id="not-found-title">
        There is no page here
      </h1>
      <p className="page-summary">
        {/* The file doesn't know which address it is served for: the browser names it (src/client/enhance.ts). */}
        Nothing lives at <span data-not-found-path="">this address</span>. It may have moved, or it
        may not be written yet.
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
