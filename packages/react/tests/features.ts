/** The features a test workspace has: Jali's defaults (as an app with `defaultFeatures()`), with or without the
 *  address. */
import { urlSync } from "@jali/core/adapter";
import { defaultFeatures } from "../src/features/defaults";

export { defaultFeatures, urlSync };
export { popOut } from "../src/features/pop-out";
export { rename } from "../src/features/rename";
export { chooser, palette, settings } from "../src/features/dialogs";

/** Jali's defaults without the address. */
export const noUrl = () => defaultFeatures().filter((f) => f.id !== "urlSync");
