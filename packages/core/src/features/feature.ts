/**
 * Features: what an app passes to `createJali({ features })` to turn a part of Jali on (`urlSync()`, `palette()`,
 * `rename({ run })`). A feature is a value, made by its own module (`jali/url`, `jali/palette`, …), so its code reaches
 * an app only through that import: an app that never imports `jali/palette` ships no palette, words included.
 *
 * What a feature can bring, and nothing else (internal: adapters read it, apps never write one):
 *
 *  - `words`: its English, merged over the instance's own before the app's `messages`;
 *  - `address`: the URL writer (one feature only: `urlSync`);
 *  - `boot` and `start`: work before the first render, and listeners for the page's lifetime (returning their stop);
 *  - `env`: options it sets on the instance (`rename`'s `{ can, run }`);
 *  - `parts`: what the framework adapter renders for it (React components, the pop out window), by name.
 *
 * Steps and commands are not a feature's: the few a feature needs (`dialogs.openPalette`, `startRename`, "Rename pane",
 * "Pop out pane") stay in core's tables, at a few bytes each, so their ids, keys and order are Jali's one list. Steps
 * are refused as `"unavailable"` without their feature, and its commands are listed only with it.
 */
import type { Env } from "../profile";
import type { StoragePort } from "../ports";
import type { MessageOverrides } from "../state/messages";
import type { JaliStore, UrlWriter } from "../state/store";
import type { Rename } from "../actions/rename";

/** The features Jali ships, by id. */
export type FeatureId =
  | "urlSync"
  | "palette"
  | "settings"
  | "chooser"
  | "rename"
  | "popOut"
  | "pressed";

/** A feature: made by its module (`urlSync()`, `palette()`), passed in `createJali({ features })`. */
export interface Feature {
  readonly id: FeatureId;
  readonly words?: MessageOverrides;
  /** The address port, from the instance's storage (`urlSync`). Undefined: no address here (a server). */
  readonly address?: (storage: StoragePort) => UrlWriter | undefined;
  readonly boot?: (store: JaliStore) => void;
  readonly start?: (store: JaliStore) => () => void;
  readonly env?: { readonly rename?: Rename };
  readonly parts?: Readonly<Record<string, unknown>>;
}

/** The feature `id` of an instance, if it has it. */
export const featureOf = (env: Pick<Env, "features">, id: FeatureId): Feature | undefined =>
  env.features?.find((f) => f.id === id);

/** A part the adapter renders for a feature (`partOf(env, "palette")`), if the instance has it. */
export const partOf = <T>(env: Pick<Env, "features">, name: string): T | undefined => {
  for (const f of env.features ?? []) if (f.parts && name in f.parts) return f.parts[name] as T;
  return undefined;
};
