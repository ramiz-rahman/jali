/**
 * The framework-free half of `rename({ can, run })`: renaming a pane in place, its command (F2) and its words. An
 * adapter adds the field (`jali/rename` gives React's).
 */
import { renameEn } from "../state/feature-messages";
import { messagesOf } from "../state/messages";
import { checkRename, type Rename } from "../actions/rename";
import type { Feature } from "./feature";

export const renameFeature = (rename: Rename, parts?: Readonly<Record<string, unknown>>): Feature => ({
  id: "rename",
  words: renameEn,
  env: { rename },
  commands: (env) => [
    {
      id: "pane.rename",
      title: messagesOf(env).commands.rename,
      group: messagesOf(env).commandGroups.pane,
      after: "tab.move.right",
      check: checkRename,
      run: (u) => u.actions.startRename(),
    },
  ],
  ...(parts ? { parts } : {}),
});
