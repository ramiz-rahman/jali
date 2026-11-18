/**
 * The active item: the one item a list is on (its cursor, the row J/K moves to), as a collection and a workspace
 * both understand it. Not the multi-select set, not DOM focus.
 *
 * The shape is Chakni's Quick Look persistence port (`core/results/quick-look-coordinator.ts`): a collection keeps its
 * current item through it and says why it changed. Jali implements it for a pane (pane/activeItem.ts), so a
 * Chakni collection inside a Jali pane drives the pane's following detail with no dependency either way: the types
 * match by shape. When Chakni publishes the port, this file is replaced by that export.
 *
 * - `step`: the cursor moved (J/K, arrows, across pages). A docked detail follows once the cursor rests.
 * - `open`: show the item (Space). Jali shows it in the list's following detail if one is on screen, else a sheet.
 * - `close`: stop showing it (Esc). The cursor stays where it is.
 */
export type ActiveItemAction = "open" | "close" | "step";

export interface ActiveItemWriteResult {
  readonly status: "accepted";
}

export interface ActiveItemPort {
  /** The item the list is on, or null. */
  readonly itemId: string | null;
  readonly write: (itemId: string | null, action: ActiveItemAction) => ActiveItemWriteResult;
}
