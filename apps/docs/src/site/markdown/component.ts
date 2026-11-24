/** What a docs component's Markdown is made from (./index.ts): its attributes, and its own text already written. */

/** A tag's attributes: text as written, `{x}` as the `?raw` import it names, or `true` for a bare flag. */
export type Props = Record<string, string | true>;

/**
 * A component as Markdown. `inner` is the text between its tags, its own components already written; a self-closing
 * tag has none, and its Markdown ends with its own words (the newlines after them go). Site links stay as written
 * (`/guides/theming`): the caller's `link` rewrites them all at the end.
 */
export type MarkdownComponent = (props: Props, inner: string) => string;

/** An attribute as text, or undefined when it is missing or a bare flag. */
export const str = (p: Props, key: string) =>
  typeof p[key] === "string" ? (p[key] as string) : undefined;

/**
 * A live part (an island, or the landing's proofs): it can't be Markdown, so it says what it shows, in one line,
 * with its link to more when it has one.
 */
export const liveDemo: MarkdownComponent = (p, inner) => {
  const what = (str(p, "caption") ?? str(p, "title"))?.replace(/[^.!?]$/, "$&.");
  const more = str(p, "href");
  const line = what
    ? `\n\n*Live demo on the site: ${what}${more ? ` See [${str(p, "more") ?? "more"}](${more}).` : ""}*\n\n`
    : "";
  return inner ? `${line}${inner}\n\n` : line;
};
