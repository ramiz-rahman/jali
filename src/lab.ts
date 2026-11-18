/** The lab's two apps in one workspace: Data Studio's kinds, plus the loan review's kinds and profile. */
import { dataStudioKinds } from "./panes";
import { loanReview, loanReviewKinds } from "./review";
import { createPaneKinds } from "./ui/pane-kinds";
import { createUiStore, type UiStore, type UiStoreDeps } from "./ui/state/store";

export const labKinds = () => createPaneKinds([...dataStudioKinds, ...loanReviewKinds]);

/** A store with the lab's kinds and profile; `deps` adds or overrides the rest (tests pass `initial`, `url`, ...). */
export function createLabStore(deps: Partial<UiStoreDeps> = {}): UiStore {
  return createUiStore({ kinds: labKinds(), profile: loanReview, ...deps });
}
