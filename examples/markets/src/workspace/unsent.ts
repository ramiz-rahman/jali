/**
 * The question before work is lost. Markets asks it itself rather than Jali (`confirmDiscard: false` and
 * `beforeClose`, index.ts), so it can speak of orders, not "unsaved changes". The dialog that asks it is the shell's
 * (shell/Question.tsx); a test answers it directly.
 */
import type { CloseRequest } from "jali";

export interface Question {
  title: string;
  body: string;
  /** The button that keeps the work: focused first, and what Esc does. */
  keep: string;
  /** The button that lets it go. */
  discard: string;
}

/** Ask `question`: true when the person lets the work go. */
export type Ask = (question: Question) => boolean | Promise<boolean>;

/** What a change would lose, as a question; none when it loses nothing. `lost` is each pane's own words for its work
 *  (the blotter's `useUnsaved`: "an unsent order to buy 100 LMNA"). */
export function unsentQuestion(
  lost: readonly string[],
  reason: CloseRequest["reason"],
): Question | undefined {
  if (!lost.length) return undefined;
  const one = lost.length === 1;
  // A close names itself; a desk change, Reset or Back don't.
  const loses =
    reason === "close"
      ? "Closing the blotter loses"
      : "This change takes the blotter away, and with it";
  return {
    title: one ? "Discard the unsent order?" : "Discard the unsent orders?",
    body: `${loses} ${lost.join(" and ")}.`,
    keep: one ? "Keep the order" : "Keep the orders",
    discard: "Discard",
  };
}
