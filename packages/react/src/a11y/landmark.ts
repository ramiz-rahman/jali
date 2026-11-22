/**
 * Landmark names in an instance the host named (`<JaliRoot aria-label>`, `aria-labelledby`, or `createJali({ label })`):
 * each of Jali's landmarks inside it (a pane, the shelf, the switcher, the peek, a page's views) carries the
 * instance's name too, so two instances on one page never repeat a landmark. Without a name they are Jali's own.
 */
import { createContext, useContext, useEffect } from "react";
import { useStore } from "../state/react";

/** The name `<JaliRoot>` was given at render: `label` from `aria-label` (or the text of what `by`, its
 *  `aria-labelledby`, points at, once mounted). */
export const LabelContext = /* @__PURE__ */ createContext<{ label?: string; by?: string }>({});

/** The instance's name, if it has one: `<JaliRoot>`'s, else `createJali({ label })`. */
export function useWorkspaceLabel(): { label?: string; by?: string } {
  const named = useContext(LabelContext);
  const label = named.label ?? useStore().env.label;
  return label === undefined ? named : { ...named, label };
}

/** A landmark's name, with the instance's after it when the instance has one. */
export function useLandmarkName(): (name: string) => string {
  const store = useStore();
  const { label } = useWorkspaceLabel();
  return (name) => (label ? store.messages.panes.within(name, label) : name);
}

// Development checks test the literal, so a production build drops them and their messages (dev.ts).
declare const process: { env: { NODE_ENV?: string } };

/** The names of the mounted instances' landmarks (or the heading ids that name them), to catch two the same. */
const names = new Map<string, number>();

/** Two instances on one page with the same name repeat every landmark: a development warning that says how to name
 *  them apart. */
export function useUniqueName(name: string) {
  useEffect(() => {
    const n = names.get(name) ?? 0;
    try {
      if (process.env.NODE_ENV !== "production" && n)
        console.warn(
          `Jali: two instances on this page are both named "${name}", so their landmarks repeat. Name each with ` +
            "<JaliRoot aria-label> (or aria-labelledby), or createJali({ label }).",
        );
    } catch {
      /* no `process`: production */
    }
    names.set(name, n + 1);
    return () => {
      const left = (names.get(name) ?? 1) - 1;
      if (left) names.set(name, left);
      else names.delete(name);
    };
  }, [name]);
}
