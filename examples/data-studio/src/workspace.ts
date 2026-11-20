/** Data Studio's workspace: a database browser where the person builds the layout from its pane kinds and presets. */
import { createJali, type Jali, type JaliOptions } from "@jali/core";
import { makerCommand } from "#shared/maker/maker";
import { DEFAULT_PRESET, dataStudioKinds, dataStudioLauncher, dataStudioPresets } from "./panes";

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
    url: { sizes: "link" },
    allow: { popOut: true },
    // Jali's header buttons, plus Pop out (the rest is in each pane's ⋯ menu). Pop out on also gives ⌘K Jali's
    // "Pop out pane" (Document Picture-in-Picture; Chrome and Edge on desktop).
    buttons: (defaults) => [...defaults.filter((b) => b !== "close"), "popOut", "close"],
    commands: [makerCommand],
  });
