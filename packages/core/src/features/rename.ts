/**
 * The framework-free half of `rename({ can, run })`: renaming a pane in place, and its words. Its command (F2) is
 * core's, listed only with the feature. An adapter adds the field (`jali-layout/rename` gives React's).
 */
import { renameEn } from "../state/feature-messages";
import type { Rename } from "../actions/rename";
import type { AdapterParts, Feature } from "./feature";

export const renameFeature = (rename: Rename, parts?: AdapterParts): Feature => ({
  id: "rename",
  words: renameEn,
  env: { rename },
  parts,
});
