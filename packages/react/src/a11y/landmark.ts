/**
 * Landmark names in a workspace the host named (`<JaliRoot aria-label>`, `aria-labelledby`, or `createJali({ label })`):
 * each of Jali's landmarks inside it (a pane, the shelf, the switcher, the peek, a page's views) carries the
 * workspace's name too, so two workspaces on one page never repeat a landmark. Without a name they are Jali's own.
 */
import { createContext, useContext } from "react";
import { useStore } from "../state/react";

/** The name `<JaliRoot>` was given at render: `label` from `aria-label` (or the text of what `by`, its
 *  `aria-labelledby`, points at, once mounted). */
export const LabelContext = /* @__PURE__ */ createContext<{ label?: string; by?: string }>({});

/** The workspace's name, if it has one: `<JaliRoot>`'s, else `createJali({ label })`. */
export function useWorkspaceLabel(): { label?: string; by?: string } {
  const named = useContext(LabelContext);
  const label = named.label ?? useStore().env.label;
  return label === undefined ? named : { ...named, label };
}

/** A landmark's name, with the workspace's after it when the workspace has one. */
export function useLandmarkName(): (name: string) => string {
  const store = useStore();
  const { label } = useWorkspaceLabel();
  return (name) => (label ? store.messages.panes.within(name, label) : name);
}
