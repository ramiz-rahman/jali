/**
 * What opening an order from the list does, in one place: the list's click, Enter and menu use it, and so does the
 * hero's tour, so the tour always shows what a click really does.
 */
import type { JaliActions } from "jali/adapter";
import { orderKind } from "./panes/OrderPane";

/** A pane as these read it, from Jali's model (the public one or the adapter's): what it is linked to and follows. */
interface Linked {
  linkedTo?: string;
  follows?: boolean;
}

/** The pane following `list`'s selection, if one is (a kept or closed detail leaves none). */
export const followerOf = <P extends Linked>(m: { panes: readonly P[] }, list: string) =>
  m.panes.find((p) => p.linkedTo === list && p.follows);

/**
 * Show order `id` in the detail following `list`. With nothing following (the detail there is kept, or closed), it
 * opens beside as the new following one, so "keep this one, open the next" compares two orders.
 */
export function openOrder(
  actions: Pick<JaliActions, "select" | "openBeside">,
  m: { panes: readonly Linked[] },
  list: string,
  id: number,
) {
  const ref = orderKind({ id });
  actions.select(list, ref);
  if (!followerOf(m, list)) actions.openBeside(list, ref);
}
