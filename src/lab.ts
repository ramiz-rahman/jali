/** The lab's two apps in one workspace: Data Studio's kinds, plus the loan review's kinds and page. */
import { DEFAULT_PRESET, dataStudioKinds, dataStudioLauncher, dataStudioPresets } from "./panes";
import {
  browserStorage,
  createPaneKinds,
  createUiStore,
  toLayout,
  type UiStore,
  type UiStoreDeps,
} from "@jali/core/adapter";
import { createJali, type Jali, type JaliOptions } from "@jali/core";
import { loanReview, loanReviewKinds } from "./review";
import { unstable_popOut } from "@jali/react";

/** What the lab's workspace is made of. */
export const labOptions = {
  panes: [...dataStudioKinds, ...loanReviewKinds],
  launcher: dataStudioLauncher,
  page: loanReview,
  presets: dataStudioPresets,
  preset: DEFAULT_PRESET,
  name: "Data Studio",
  // The lab's saved settings and pages predate the "jali" default.
  storage: "pane-lab",
  // The lab is the whole page and has no <main> of its own: the panes are it.
  landmark: "main",
} satisfies JaliOptions;

/** The lab app's workspace. Data Studio links reopen exactly, sizes included (the founder's round-trip rule, 17 Nov). */
export const createLabJali = (): Jali =>
  createJali({
    ...labOptions,
    url: { sizes: "link" },
    allow: { popOut: true },
    // The Pop out prototype (Document Picture-in-Picture; Chrome and Edge on desktop).
    commands: [
      {
        id: "lab.pop_out",
        title: "Pop out pane (experimental)",
        group: "Pane",
        run: (jali) => void unstable_popOut(jali),
      },
    ],
  });

export const labKinds = () =>
  createPaneKinds([...labOptions.panes, { ...dataStudioLauncher, transient: true }]);

/**
 * For the engine tests: the lab's store before it boots, with nothing outside it (no address, no DOM focus unless
 * given). `deps` adds or overrides the rest (tests pass `initial`, `url`, ...).
 */
export function createLabStore(deps: Partial<UiStoreDeps> = {}): UiStore {
  return createUiStore({
    kinds: labKinds(),
    launcher: dataStudioLauncher.kind,
    profile: loanReview,
    presets: dataStudioPresets.map((p) => ({
      id: p.id,
      label: p.label,
      build: () => toLayout(typeof p.layout === "function" ? p.layout() : p.layout),
    })),
    preset: DEFAULT_PRESET,
    name: "Data Studio",
    storage: browserStorage("pane-lab"),
    ...deps,
  });
}
