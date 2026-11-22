/**
 * Defining a curated page for React. Apart from define.ts so that only this module brings the page's parts
 * (chrome/PageBar.tsx): the types in define.ts, which the rest of the package reads, import none of them.
 */
import { definePageEngine, warnUnknown } from "@jali/core/adapter";
import { pageParts } from "./chrome/PageBar";
import type { Page } from "./define";
import { PAGE_PARTS } from "./page-parts";

declare const process: { env: { NODE_ENV?: string } };

/**
 * Makes a curated page: `definePage({ id, name, roles, ... })`, for `createJali({ page })`. It gives the page the code
 * that runs it (core's `definePageEngine`) and the parts that render it, so an app that never calls it ships neither.
 */
export function definePage(page: Page<number>): Page<number>;
export function definePage(page: Page<string>): Page<string>;
export function definePage(page: Page): Page {
  try {
    if (process.env.NODE_ENV !== "production") warnUnknown("definePage", page);
  } catch {
    /* no `process`: production */
  }
  return { ...definePageEngine(page), [PAGE_PARTS]: pageParts };
}
