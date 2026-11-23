import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Prose } from "./prose";
import { filterTerms } from "#src/course/glossary.ts";

describe("Prose", () => {
  it("renders paragraphs, lists, code and emphasis", () => {
    const html = renderToStaticMarkup(
      <Prose
        body={["A `code` and *em* and **strong**.", "- one\n- two", "```\nx = 1\n```"]}
        onTerm={vi.fn()}
      />,
    );
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain("<strong>strong</strong>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<pre");
    expect(html).toContain("x = 1");
  });

  it("makes a glossary link a button labelled with the term, or with its own label", () => {
    const html = renderToStaticMarkup(
      <Prose body={["[[mss]] and [[mtu|the MTU]]"]} onTerm={vi.fn()} />,
    );
    expect(html).toMatch(/<button[^>]*class="term"[^>]*>MSS/);
    expect(html).toMatch(/<button[^>]*class="term"[^>]*>the MTU/);
  });

  it("leaves an unknown term as plain text instead of a dead button", () => {
    const html = renderToStaticMarkup(<Prose body={["[[no-such-term]]"]} onTerm={vi.fn()} />);
    expect(html).not.toContain("<button");
    expect(html).toContain("no-such-term");
  });

  it("does not turn text into markup", () => {
    const html = renderToStaticMarkup(
      <Prose body={["<script>alert(1)</script>"]} onTerm={vi.fn()} />,
    );
    expect(html).not.toContain("<script>");
  });
});

describe("filterTerms", () => {
  it("sorts, and filters by name or id, ignoring case", () => {
    const names = filterTerms("").map((t) => t.term.toLowerCase());
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(filterTerms("  sack ").map((t) => t.id)).toContain("sack");
    expect(filterTerms("zzzz")).toEqual([]);
  });
});
