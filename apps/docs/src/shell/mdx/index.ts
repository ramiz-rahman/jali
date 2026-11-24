/**
 * The components MDX pages use without importing them. The names and props are the contract with every page
 * (apps/docs/AGENTS.md); the implementations may change, never the names.
 *
 * Each renders static HTML at build time, code already highlighted. What one does in the browser (copy, wrap lines,
 * switch tabs, the install menu) sits beside it in a `.client.ts` file, which finds it by its data attributes; each
 * one's Markdown, for the Markdown copies, is in ./markdown.ts.
 */
import type { MDXComponents } from "mdx/types";
import { Callout } from "./Callout";
import { Card, Cards } from "./Cards";
import { Code, InlineCode, Pre } from "./Code";
import { heading } from "./Heading";
import { Install } from "./Install";
import { MediaImage } from "./media";
import { Anchor, Table } from "./prose";
import { Step, Steps } from "./Steps";
import { Tab, Tabs } from "./Tabs";

export { Code, CodeBody } from "./Code";
export { Install } from "./Install";
export { Tab, TabSet, Tabs } from "./Tabs";

export const mdxComponents: MDXComponents = {
  Code,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Install,
  Cards,
  Card,
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  pre: Pre as MDXComponents["pre"],
  code: InlineCode,
  table: Table,
  a: Anchor,
  img: MediaImage as MDXComponents["img"],
};
