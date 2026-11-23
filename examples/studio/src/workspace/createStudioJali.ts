/**
 * The workspace: the pane kinds, the layouts (presets), the launcher, and the app's own commands in ⌘K.
 * `createStudioJali` takes the app's services and Jali's usual options, so a test can give it a memory address,
 * memory storage and a fixed size (workspace.test.ts).
 *
 * Space: every audio tool plays and pauses with it. Jali binds no single keys (they belong to the focused content),
 * so nothing of Jali's needs moving; the app takes Space itself (shell/keys.ts) and names it in `keyboard.reserved`, so a
 * later Jali binding on Space would be refused at start-up rather than fight the transport.
 */
import { createJali, type Jali, type JaliOptions } from "jali";
import { defaultFeatures } from "jali/features";
import { clip } from "../panes/clip";
import { credits } from "../panes/credits";
import { launcher } from "../panes/launcher";
import { library } from "../panes/library";
import { markers } from "../panes/markers";
import { mixer } from "../panes/mixer";
import { timeline } from "../panes/timeline";
import { transcript } from "../panes/transcript";
import type { Services } from "../services";
import { studioCommands } from "./commands";
import { layoutsFollowTransport } from "./followTransport";
import { presets } from "./presets";

export const kinds = [library, transcript, timeline, mixer, markers, clip, credits];

type Options = Pick<
  JaliOptions,
  "features" | "storage" | "size" | "moveFocus" | "preset" | "keyboard"
>;

export function createStudioJali(services: Services, options: Options = {}): Jali {
  const jali = createJali({
    panes: kinds,
    launcher,
    // Each layout comes back as the person left it; Reset builds its design again.
    presets: presets.map((p) => ({ ...p, saved: () => services.layouts.get(p.id) })),
    commands: studioCommands(services),
    name: "Studio",
    // Header shortcuts: Maximise and Close. Tuck, Full screen and Pop out are in the pane's ⋯ menu (and ⌘K), so a
    // header carries two keys and the pane's name stays its strongest mark.
    buttons: (defaults) => defaults.filter((b) => b !== "tuck"),
    storage: "studio",
    phone: { stack: true },
    ...options,
    // Jali's usual features; a test's own (its address in memory) take their places.
    features: [...defaultFeatures(), ...(options.features ?? [])],
    keyboard: {
      ...options.keyboard,
      // Bound like Jali's own commands: ⌘K then ⌘P plays, ⌘K then ⌘J goes to a segment.
      keymap: { "studio.play": "Mod+K Mod+P", "studio.segment": "Mod+K Mod+J" },
      // Space is the transport's (shell/keys.ts). Jali binds nothing to it; this keeps it that way.
      reserved: ["Space"],
    },
  });
  services.layouts.track(jali);
  layoutsFollowTransport(jali, services.engine);
  return jali;
}
