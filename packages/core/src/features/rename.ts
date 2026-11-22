/**
 * The framework-free half of `rename({ can, run })`: renaming a pane in place, its command (F2) and its words. An
 * adapter adds the field (`jali/rename` gives React's).
 */
import { renameEn } from "../state/feature-messages";
import { checkRename, type Rename } from "../actions/rename";
import { featureCommand, type Feature } from "./feature";

const command = featureCommand(
  "pane.rename",
  "tab.move.right",
  (m) => m.commands.rename,
  "pane",
  (u) => u.actions.startRename(),
  checkRename,
);

export const renameFeature = (
  rename: Rename,
  parts?: Readonly<Record<string, unknown>>,
): Feature => ({
  id: "rename",
  words: renameEn,
  env: { rename },
  commands: (env) => [command(env)],
  parts,
});
