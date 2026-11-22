/** Data Studio's workspace: a database browser where the person builds the layout from its pane kinds and presets. */
import { createJali, type Jali, type JaliOptions } from "jali";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { DEFAULT_PRESET, dataStudioKinds, dataStudioLauncher, dataStudioPresets } from "./panes";
import { defaultFeatures } from "jali/features";
import { popOut } from "jali/pop-out";
import { urlSync } from "jali/url";

/** What Data Studio's workspace is made of. */
export const dataStudioOptions = {
  panes: dataStudioKinds,
  launcher: dataStudioLauncher,
  presets: dataStudioPresets,
  preset: DEFAULT_PRESET,
  name: "Data Studio",
  storage: "data-studio",
  // The app is the whole page and has no <main> of its own: the panes are it.
  landmark: "main",
} satisfies JaliOptions;

/** Links reopen exactly, sizes included (the founder's round-trip rule, 17 Nov). */
export const createDataStudio = (): Jali =>
  createJali({
    ...dataStudioOptions,
    // Jali's usual features, links with every size, and Pop out: among Jali's header buttons, before Close, and
    // Jali's "Pop out pane" in ⌘K (Document Picture-in-Picture; Chrome and Edge on desktop).
    features: [...defaultFeatures(), urlSync({ sizes: "link" }), popOut()],
    commands: [makerCommand],
  });
