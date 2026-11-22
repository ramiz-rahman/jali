/**
 * `defaultFeatures()`: every feature Jali turned on by itself before features were opt-in, in one call, so an app
 * that wants today's behaviour writes one line: the address (`urlSync()`), ⌘K (`palette()`), Settings (`settings()`),
 * the chooser (`chooser()`) and `data-pressed` (`pressed()`). Rename and Pop out need your app's say, so they are
 * not in it: add them after (`[...defaultFeatures(), rename({ run }), popOut()]`). A feature given again later takes
 * the earlier one's place: `[...defaultFeatures(), urlSync({ location })]`.
 */
import { urlSync, type Feature } from "@jali/core/adapter";
import { chooser, palette, settings } from "./dialogs";
import { pressed } from "./pressed";

export const defaultFeatures = (): Feature[] => [
  urlSync(),
  palette(),
  settings(),
  chooser(),
  pressed(),
];
