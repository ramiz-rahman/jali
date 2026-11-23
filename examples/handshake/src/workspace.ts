/**
 * The workspace: the pane kinds, the layouts to start from (presets), and the app's own commands in ⌘K.
 * `createHandshakeJali` takes Jali's usual options, so a test can give it a memory address, memory storage and a
 * fixed size (workspace.test.ts).
 */
import { createJali, type Jali, type JaliOptions } from "jali";
import { defaultFeatures } from "jali/features";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { themeCommand } from "@jali-examples/shared/theme";
import { kinds } from "./kinds";
import { presets } from "./presets";

type Options = Pick<
  JaliOptions,
  "features" | "storage" | "size" | "moveFocus" | "preset" | "keyboard"
>;

export function createHandshakeJali(options: Options = {}): Jali {
  return createJali({
    panes: kinds,
    presets,
    commands: [themeCommand("handshake.theme"), makerCommand],
    name: "Handshake",
    storage: "handshake",
    // Dark first: until the person picks a theme, a lab is dark.
    settings: { theme: "dark" },
    ...options,
    features: [...defaultFeatures(), ...(options.features ?? [])],
  });
}
