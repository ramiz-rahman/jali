/**
 * The workspace: the pane kinds, the four layouts (presets.ts), the launcher, and the app's own commands in ⌘K
 * (commands.ts). `createTripsJali` takes the app's services and Jali's usual options, so a test can give it a memory
 * address, memory storage and a fixed size.
 */
import { createJali, type Jali, type JaliOptions } from "jali-layout";
import { defaultFeatures } from "jali-layout/features";
import { popOut } from "jali-layout/pop-out";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { budget } from "../panes/budget/budget";
import { day } from "../panes/day/day";
import { explore } from "../panes/explore/explore";
import { launcher } from "../panes/launcher/launcher";
import { map } from "../panes/map/map";
import { place } from "../panes/place/place";
import { trip } from "../panes/trip/trip";
import type { Services } from "../state/services";
import { KEYMAP, tripCommands } from "./commands";
import { presets } from "./presets";

export const kinds = [trip, map, day, place, explore, budget];

type Options = Pick<
  JaliOptions,
  "features" | "storage" | "size" | "moveFocus" | "preset" | "keyboard"
>;

export function createTripsJali(services: Services, options: Options = {}): Jali {
  return createJali({
    panes: kinds,
    launcher,
    presets,
    commands: [...tripCommands(services), makerCommand],
    name: "Trip",
    // A new prefix for the Thailand trip, so pane state saved for the Lisbon one (a cursor on a Lisbon place) is left behind.
    storage: "trips-thailand",
    // On a portrait phone: a pane with the one it follows, one above the other. The place shows under the map it
    // follows, and the day under the overview, instead of one at a time.
    phone: { stack: true },
    ...options,
    // Jali's usual features, and Pop out: a day beside the map on a second screen. Its button goes before Close in
    // each header (the rest is in the pane's ⋯ menu), and ⌘K has Jali's "Pop out pane". A test's own features (its
    // address in memory) take their places.
    features: [...defaultFeatures(), popOut(), ...(options.features ?? [])],
    keyboard: { ...options.keyboard, keymap: KEYMAP },
  });
}
