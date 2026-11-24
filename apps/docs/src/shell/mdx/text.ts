/** Text from a React tree, and ids made from it: what the docs components need to name and link what they render. */
import { isValidElement, useId, type ReactNode } from "react";

/** The plain text inside a React tree (a fenced block's lines, a heading's words). */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`'"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** An id from React's `useId` that is a plain word, for `id` and `aria-controls`. */
export const usePlainId = () => useId().replace(/[^\w-]/g, "");
