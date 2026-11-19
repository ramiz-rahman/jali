/**
 * `jali.actions.choose`: Jali's chooser asks the person for one item from a list the app gives, for a command that
 * needs an argument ("Open chart for…"). It is the dialog "Add to tabs of…" uses: type to filter, arrows to move,
 * Enter to choose, Esc to close, read out as a combobox over a listbox. Its words are the app's (`title`, `label`,
 * `hint`) and Jali's messages (`chooser.choose*`).
 */
import { refuse, type Outcome, type Snapshot } from "../state/apply";

/** What `jali.actions.choose` asks the person for. `T` is whatever the app's items are. */
export interface ChooseOptions<T> {
  /** What the choice is for: the dialog's name, its heading and its field's label ("Open chart for…"). */
  title: string;
  /** What to choose from, in order. Typing keeps those whose label or hint has the text, labels that start with it
   *  first. */
  items: readonly T[];
  /** An item's name in the list. */
  label: (item: T) => string;
  /** Words beside the name, matched too ("Lumina Corp · Equity"). */
  hint?: (item: T) => string;
  /** The field's placeholder. Default: `messages.chooser.choosePlaceholder`. */
  placeholder?: string;
  /** The chosen item, once the chooser has closed and focus is back where it was. Esc or a click outside chooses
   *  nothing, and this is not called. */
  onChoose: (item: T) => void;
}

/** Open the chooser on `options` (closing ⌘K if it is open). Without a title or a way to name items: `"invalid"`. */
export function choose(_x: Snapshot, options: ChooseOptions<unknown>): Outcome {
  if (!options?.title || typeof options.label !== "function" || !Array.isArray(options.items))
    return refuse("invalid");
  return {
    op: "patch",
    patch: { chooser: { kind: "choose", request: options }, paletteOpen: false },
  };
}
