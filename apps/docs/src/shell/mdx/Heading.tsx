/**
 * A heading with an id, and a link to it beside it: the link comes after the heading, outside it, so the heading is
 * read as its words alone, and the link is in the Tab order with its own name ("Link to this section: …"), for every
 * level, h4s included (which "On this page" leaves out). It shows in the margin on hover and on focus
 * (docs/DECISIONS.md, 21 Nov 2026). h2 and h3 are listed for "On this page" and search while the page is built.
 */
import type { ComponentPropsWithoutRef } from "react";
import { LinkIcon } from "@phosphor-icons/react";
import { useTocEntry } from "../collect";
import { slugify, textOf } from "./text";

export function heading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function Heading({ id, children, ...rest }: ComponentPropsWithoutRef<"h2">) {
    const text = textOf(children).trim();
    const slug = id ?? slugify(text);
    useTocEntry(level === 4 ? null : { id: slug, text, level });
    return (
      <div className="heading-wrap" data-level={level}>
        <Tag id={slug} className="heading" {...rest}>
          {children}
        </Tag>
        <a className="heading-anchor" href={`#${slug}`}>
          <LinkIcon aria-hidden size={14} />
          <span className="visually-hidden">Link to this section: {text}</span>
        </a>
      </div>
    );
  };
}
