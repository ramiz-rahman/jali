/** A grid of links to other pages: <Cards><Card title href>…</Card></Cards>. */
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";

export function Cards({ children }: { children?: ReactNode }) {
  return <div className="cards">{children}</div>;
}

export function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children?: ReactNode;
}) {
  return (
    <a className="card" href={href}>
      <span className="card-title">
        {title}
        <ArrowRightIcon aria-hidden className="card-arrow" size={16} />
      </span>
      {children ? <span className="card-text">{children}</span> : null}
    </a>
  );
}
