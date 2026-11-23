import { describe, expect, it } from "vitest";
import { parseBlock, parseBody, parseInline, termsIn } from "./markup";

describe("parseInline", () => {
  it("reads code, emphasis, strong and glossary links", () => {
    expect(parseInline("a `b` *c* **d** [[mss]] [[mtu|the MTU]]")).toEqual([
      { t: "text", v: "a " },
      { t: "code", v: "b" },
      { t: "text", v: " " },
      { t: "em", v: [{ t: "text", v: "c" }] },
      { t: "text", v: " " },
      { t: "strong", v: [{ t: "text", v: "d" }] },
      { t: "text", v: " " },
      { t: "term", id: "mss", label: undefined },
      { t: "text", v: " " },
      { t: "term", id: "mtu", label: "the MTU" },
    ]);
  });

  it("keeps markers that open nothing as text", () => {
    expect(parseInline("2 * 3 and a ` lone tick and [[open")).toEqual([
      { t: "text", v: "2 * 3 and a ` lone tick and [[open" },
    ]);
  });

  it("does not read markup inside code", () => {
    expect(parseInline("`*not em* [[nor]]`")).toEqual([{ t: "code", v: "*not em* [[nor]]" }]);
  });

  it("nests emphasis in strong", () => {
    expect(parseInline("**a *b* c**")).toEqual([
      {
        t: "strong",
        v: [
          { t: "text", v: "a " },
          { t: "em", v: [{ t: "text", v: "b" }] },
          { t: "text", v: " c" },
        ],
      },
    ]);
  });
});

describe("parseBlock", () => {
  it("reads a list, a code block and a paragraph", () => {
    expect(parseBlock("- one\n- two")).toEqual({
      t: "ul",
      v: [[{ t: "text", v: "one" }], [{ t: "text", v: "two" }]],
    });
    expect(parseBlock("```\n$ dig a\n  b\n```")).toEqual({ t: "pre", v: "$ dig a\n  b" });
    expect(parseBlock("plain")).toEqual({ t: "p", v: [{ t: "text", v: "plain" }] });
  });

  it("does not make a list of a paragraph that merely starts with a dash line", () => {
    expect(parseBlock("- one\nplain").t).toBe("p");
  });
});

describe("termsIn", () => {
  it("collects linked terms once, through lists and emphasis", () => {
    const blocks = parseBody(["[[a]] and *[[b]]*", "- [[a]]\n- [[c|see c]]"]);
    expect(termsIn(blocks)).toEqual(["a", "b", "c"]);
  });
});
