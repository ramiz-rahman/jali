import { describe, expect, it } from "vitest";
import { lessonById } from "./lessons";
import { clampStep, coursePercent, firstOpen, isCheck, pagesOf, pagesRead, resume } from "./pages";

const tcp = lessonById("tcp")!;

describe("pages", () => {
  it("count the steps and the check", () => {
    expect(pagesOf(tcp)).toBe(11);
    expect(isCheck(tcp, 10)).toBe(true);
    expect(isCheck(tcp, 9)).toBe(false);
  });

  it("read a step from a link as a page that exists", () => {
    expect(clampStep(3, 11)).toBe(3);
    expect(clampStep(3.9, 11)).toBe(3);
    expect(clampStep(-4, 11)).toBe(0);
    expect(clampStep(99, 11)).toBe(10);
    expect(clampStep(Number.NaN, 11)).toBe(0);
  });

  it("resume where the person stopped, and start on the first unfinished lesson", () => {
    expect(resume({}, tcp)).toBe(0);
    expect(resume({ tcp: { step: 4, reached: 5 } }, tcp)).toBe(4);
    expect(resume({ tcp: { step: 40, reached: 41 } }, tcp)).toBe(10);
    expect(firstOpen({})?.id).toBe("encapsulation");
    expect(firstOpen({ encapsulation: { step: 8, reached: 9 } })?.id).toBe("wifi");
  });

  it("count what has been read, never past a lesson", () => {
    expect(pagesRead({ tcp: { step: 40, reached: 41 } }, tcp)).toBe(11);
    expect(coursePercent({})).toBe(0);
    expect(coursePercent({ tcp: { step: 10, reached: 11 } })).toBeGreaterThan(0);
  });
});
