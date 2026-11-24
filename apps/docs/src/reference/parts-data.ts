/**
 * The styling contract, from jali/react itself (packages/react/src/parts.ts): every public part, its selector, what
 * it is, and the state attributes it carries. The page's table (Parts.tsx) and its Markdown (./markdown.ts) are both
 * drawn from here. The sentences write code in backticks.
 */
import { ADORNMENTS, parts, type PartArea } from "./jali-sources";

export type { PartArea };

/** The parts, all of them or one area's, by name. */
export const partsIn = (area?: PartArea) =>
  Object.entries(parts).filter(([, part]) => !area || part.area === area);

/** What a part is, with the sentence about its adornments when it has them. */
export const partWhat = (part: (typeof parts)[keyof typeof parts]) =>
  "adornments" in part ? `${part.what} ${ADORNMENTS}` : part.what;

/** An element name as code, keeping any note after it: `button`, or `div` (`role="menu"`). */
export const elementCode = (e: string) => (e.startsWith("`") ? e : e.replace(/^(\w+)/, "`$1`"));
