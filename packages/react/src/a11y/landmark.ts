/**
 * Landmark names in a workspace the host named (`createJali({ label })`): each of Jali's landmarks inside it (a pane,
 * the shelf, the switcher, the peek, a page's views) carries the workspace's name too, so two workspaces on one page
 * never repeat a landmark. Without a label the names are Jali's own, unchanged.
 */
import type { Env, Messages } from "@jali/core";

export const landmarkName = (store: { env: Env; messages: Messages }, name: string): string =>
  store.env.label ? store.messages.workspace.within(name, store.env.label) : name;
