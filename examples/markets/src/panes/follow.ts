/**
 * One watchlist, several followers. The watchlist selects a quote (`quote({ symbol })`), so its following quote
 * shows it. The chart, book, trades and news that follow it show the same instrument: each kind's `follow` says what
 * it shows for the selected quote, and Jali moves them all together once the selection rests.
 */
import type { ObjectRef } from "jali";

/** A kind's `follow`: the selected instrument's symbol. */
export const followSymbol = (selected: ObjectRef) => ({ symbol: selected.params.symbol });
