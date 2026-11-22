/**
 * The engine tests' workspace: Data Studio's kinds, presets and launcher, with Loan review's kinds and page beside
 * them, so one store covers the free workspace, the curated page and moving between them. The example apps each run
 * one of the two; only these tests hold both.
 */
import {
  browserStorage,
  createPaneKinds,
  createUiStore,
  toLayout,
  type UiStore,
  type UiStoreDeps,
} from "@jali/core/adapter";
import {
  DEFAULT_PRESET,
  dataStudioKinds,
  dataStudioLauncher,
  dataStudioPresets,
} from "../../../examples/data-studio/src/panes";
import { loanReview, loanReviewKinds } from "../../../examples/loan-review/src/review";
import { setFacts } from "../../../examples/loan-review/src/review/facts";
import { applicationFacts, LOAN_BOOK } from "../../../examples/shared/src/data/sample-sql";

// Loan review binds its views from the database's facts (review/facts.ts). There is no database here, so the facts
// are the sample's, as it is generated.
setFacts(Array.from({ length: LOAN_BOOK.applications }, (_, i) => applicationFacts(i + 1)));

export const testKinds = () =>
  createPaneKinds([
    ...dataStudioKinds,
    ...loanReviewKinds,
    { ...dataStudioLauncher, transient: true },
  ]);

/**
 * The store before it boots, with nothing outside it (no address, no DOM focus unless given). `deps` adds or
 * overrides the rest (tests pass `initial`, `url`, ...).
 */
export function createTestStore(deps: Partial<UiStoreDeps> = {}): UiStore {
  return createUiStore({
    kinds: testKinds(),
    launcher: dataStudioLauncher.kind,
    profile: loanReview,
    presets: dataStudioPresets.map((p) => ({
      id: p.id,
      label: p.label,
      build: () => toLayout(typeof p.layout === "function" ? p.layout() : p.layout),
    })),
    preset: DEFAULT_PRESET,
    name: "Data Studio",
    storage: browserStorage("jali-tests"),
    ...deps,
  });
}
