/** The lab's two apps in one workspace: Data Studio's kinds, plus the loan review's kinds and profile. */
import { DEFAULT_PRESET, dataStudioKinds, dataStudioPresets } from "./panes";
import { browserStorage, createPaneKinds, createUiStore, type UiStore, type UiStoreDeps } from "@jali/core";
import { loanReview, loanReviewKinds } from "./review";

export const labKinds = () => createPaneKinds([...dataStudioKinds, ...loanReviewKinds]);

/** A store with the lab's kinds and profile; `deps` adds or overrides the rest (tests pass `initial`, `url`, ...). */
export function createLabStore(deps: Partial<UiStoreDeps> = {}): UiStore {
  return createUiStore({
    kinds: labKinds(), profile: loanReview, presets: dataStudioPresets, preset: DEFAULT_PRESET, name: "Data Studio",
    // The lab's saved settings and pages predate the "jali" default.
    storage: browserStorage("pane-lab"),
    ...deps,
  });
}
