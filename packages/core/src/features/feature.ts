/**
 * Features: what an app passes to `createJali({ features })` to turn a part of Jali on (`urlSync()`, `palette()`,
 * `rename({ run })`). A feature is a value, made by its own module (`jali/url`, `jali/palette`, …), so its code reaches
 * an app only through that import: an app that never imports `jali/palette` ships no palette, words included.
 *
 * What a feature can bring, and nothing else (internal: adapters read it, apps never write one):
 *
 *  - `words`: its English, merged over the workspace's own before the app's `messages`;
 *  - `commands`: its ⌘K commands, each placed after one of Jali's (`after`), so the palette's order stays Jali's;
 *  - `address`: the URL writer (one feature only: `urlSync`);
 *  - `boot` and `start`: work before the first render, and listeners for the page's lifetime (returning their stop);
 *  - `env`: options it sets on the workspace (`rename`'s `{ can, run }`);
 *  - `parts`: what the framework adapter renders for it (React components, the pop out window), by name.
 *
 * Steps (actions) are not a feature's: the workspace's few steps a feature needs (`dialogs.openPalette`,
 * `startRename`) stay in core, at a few bytes each, and are refused as `"unavailable"` without the feature.
 */
import type { CommandDef } from "../commands/registry";
import type { Env } from "../profile";
import type { StoragePort } from "../ports";
import { messagesOf, type MessageOverrides, type Messages } from "../state/messages";
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

/** A command a feature brings, and the command of Jali's it is listed after. */
export interface FeatureCommand extends CommandDef {
  after?: string;
}

/** A feature: made by its module (`urlSync()`, `palette()`), passed in `createJali({ features })`. */
export interface Feature {
  readonly id: FeatureId;
  readonly words?: MessageOverrides;
  readonly commands?: (env: Env) => readonly FeatureCommand[];
  /** The address port, from the workspace's storage (`urlSync`). Undefined: no address here (a server). */
  readonly address?: (storage: StoragePort) => UrlWriter | undefined;
  readonly boot?: (store: JaliStore) => void;
  readonly start?: (store: JaliStore) => () => void;
  readonly env?: { readonly rename?: Rename };
  readonly parts?: Readonly<Record<string, unknown>>;
}

/** One of a feature's commands, in the workspace's words: `title` and `group` pick them from its messages. */
export const featureCommand =
  (
    id: string,
    after: string,
    title: (m: Messages) => string,
    group: keyof Messages["commandGroups"],
    run: CommandDef["run"],
    check?: CommandDef["check"],
  ) =>
  (env: Env): FeatureCommand => {
    const m = messagesOf(env);
    return {
      id,
      after,
      title: title(m),
      group: m.commandGroups[group],
      run,
      ...(check ? { check } : {}),
    };
  };

/** The feature `id` of a workspace, if it has it. */
export const featureOf = (env: Pick<Env, "features">, id: FeatureId): Feature | undefined =>
  env.features?.find((f) => f.id === id);

/** A part the adapter renders for a feature (`partOf(env, "palette")`), if the workspace has it. */
export const partOf = <T>(env: Pick<Env, "features">, name: string): T | undefined => {
  for (const f of env.features ?? []) if (f.parts && name in f.parts) return f.parts[name] as T;
  return undefined;
};
