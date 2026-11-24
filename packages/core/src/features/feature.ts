/**
 * Features: what an app passes to `createJali({ features })` to turn a part of Jali on (`urlSync()`, `palette()`,
 * `rename({ run })`). A feature is a value, made by its own module (`jali-layout/url`, `jali-layout/palette`, …), so its code reaches
 * an app only through that import: an app that never imports `jali-layout/palette` ships no palette, words included.
 *
 * What a feature can bring, and nothing else (internal: adapters read it, apps never write one):
 *
 *  - `words`: its English, merged over the instance's own before the app's `messages`;
 *  - `address`: the URL writer (one feature only: `urlSync`);
 *  - `boot` and `start`: work before the first render, and listeners for the page's lifetime (returning their stop);
 *  - `env`: options it sets on the instance (`rename`'s `{ can, run }`);
 *  - `services`: what the core itself calls, each a named, typed field (Pop out's window);
 *  - `parts`: what the framework adapter renders for it (React's palette, settings panel, rename field), by name. The
 *    core never reads them: the adapter that made them reads them through its own typed map (`partsReader`).
 *
 * Steps and commands are not a feature's: the few a feature needs (`dialogs.openPalette`, `startRename`, "Rename pane",
 * "Pop out pane") stay in core's tables, at a few bytes each, so their ids, keys and order are Jali's one list. Steps
 * are refused as `"unavailable"` without their feature, and its commands are listed only with it.
 */
import type { Env } from "../env";
import type { StoragePort } from "../ports";
import type { MessageOverrides } from "../state/messages";
import type { JaliStore, UrlWriter } from "../state/store";
import type { Rename } from "../actions/rename";
import type { PopOutWindow } from "./pop-out";

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
  readonly services?: FeatureServices;
  readonly parts?: AdapterParts;
}

/** What features give the core itself, by name: each typed, so the core calls a service it knows the shape of. */
export interface FeatureServices {
  /** Pop out's window (`popOut()`): "Pop out pane" asks it whether it can, and opens and closes it. */
  readonly popOutWindow?: PopOutWindow;
}

/** What a feature's adapter renders for it, by name. Opaque to the core; an adapter reads its own through
 *  `partsReader<ItsParts>()`. */
export type AdapterParts = Readonly<Record<string, unknown>>;

/** The feature `id` of an instance, if it has it. */
export const featureOf = (env: Pick<Env, "features">, id: FeatureId): Feature | undefined =>
  env.features?.find((f) => f.id === id);

/** A service a feature gives the core (`serviceOf(env, "popOutWindow")`), if the instance has it. */
export const serviceOf = <K extends keyof FeatureServices>(
  env: Pick<Env, "features">,
  name: K,
): FeatureServices[K] | undefined => {
  for (const f of env.features ?? []) if (f.services?.[name]) return f.services[name];
  return undefined;
};

/**
 * How an adapter reads the parts it gave its features: `partsReader<ReactParts>()` gives `(env, "palette")`, typed by
 * the adapter's own map of names to parts. The map is the adapter's promise about what it put in `parts`; the core
 * keeps them as they were given.
 */
export const partsReader =
  <M extends object>() =>
  <K extends keyof M & string>(env: Pick<Env, "features">, name: K): M[K] | undefined => {
    for (const f of env.features ?? [])
      if (f.parts && Object.hasOwn(f.parts, name)) return f.parts[name] as M[K];
    return undefined;
  };
