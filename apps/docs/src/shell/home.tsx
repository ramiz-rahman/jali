/** The home page's parts: the opening, the two packages and the three ways in. The words stay in pages/index.mdx. */
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Lattice } from "./brand";

export function Hero({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="hero" aria-labelledby="hero-title" data-toc-skip="">
      <div className="hero-lattice" aria-hidden>
        <Lattice className="hero-lattice-mark" />
      </div>
      <div className="hero-text">
        <p className="hero-eyebrow">Jali for React</p>
        <h2 className="hero-title" id="hero-title">{title}</h2>
        <div className="hero-lead">{children}</div>
      </div>
    </section>
  );
}

export function HeroLinks({ children }: { children?: ReactNode }) {
  return <div className="hero-links">{children}</div>;
}
export function PrimaryLink({ href, children }: { href: string; children?: ReactNode }) {
  return <a className="button button-primary" href={href}>{children}<ArrowRight aria-hidden size={16} strokeWidth={2} /></a>;
}
export function SecondaryLink({ href, children }: { href: string; children?: ReactNode }) {
  return <a className="button button-quiet" href={href}>{children}</a>;
}

/** A section of the home page with a small label in the margin. */
export function Band({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  const id = `home-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className="band" aria-labelledby={id} data-toc-skip="">
      <header className="band-head">
        <p className="band-label">{label}</p>
        <h2 className="band-title" id={id}>{title}</h2>
      </header>
      <div className="band-body">{children}</div>
    </section>
  );
}

export function Packages({ children }: { children?: ReactNode }) {
  return <div className="packages">{children}</div>;
}
export function Package({ name, href, note, exports, children }: { name: string; href: string; note: string; exports: string; children?: ReactNode }) {
  return (
    <div className="package">
      <p className="package-note">{note}</p>
      <h3 className="package-name"><a className="package-link" href={href}>{name}</a></h3>
      <div className="package-text">{children}</div>
      <ul className="package-exports" aria-label={`Some of ${name}'s exports`}>
        {exports.split(",").map((e) => <li key={e}><code>{e.trim()}</code></li>)}
      </ul>
    </div>
  );
}

export function Ways({ children }: { children?: ReactNode }) {
  return <ol className="ways">{children}</ol>;
}
export function Way({ kind, title, href, children }: { kind: string; title: string; href: string; children?: ReactNode }) {
  return (
    <li className="way">
      <a className="way-link" href={href}>
        <span className="way-kind">{kind}</span>
        <span className="way-main">
          <span className="way-title">{title}</span>
          <span className="way-text">{children}</span>
        </span>
        <ArrowRight aria-hidden className="way-arrow" size={20} strokeWidth={1.5} />
      </a>
    </li>
  );
}
