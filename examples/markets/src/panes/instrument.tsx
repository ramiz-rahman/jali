/**
 * What every pane about one instrument shares: its params (`{ symbol }`), how it follows a watchlist, and what it
 * shows for a symbol this market doesn't have, or for one that doesn't trade.
 *
 * One watchlist, several followers. The watchlist selects a quote (`quote({ symbol })`), so its following quote shows
 * it. The chart, book, trades and news that follow it show the same instrument: each kind's `follow` says what it
 * shows for the selected quote, and Jali moves them all together once the selection rests.
 */
import type { ReactNode } from "react";
import { QuestionIcon } from "@phosphor-icons/react";
import type { ObjectRef } from "jali-layout";
import { facts } from "../market/classes";
import { useMarket } from "../market/react";
import type { Instrument } from "../market/types";
import { Empty } from "../ui/molecules/Empty";

/** A pane about one instrument: its component and `definePane` share it. */
export const symbolParams = { symbol: String };

/** A kind's `follow`: the selected instrument's symbol. */
export const followSymbol = (selected: ObjectRef) => ({ symbol: selected.params.symbol });

/**
 * Renders `children` for a known instrument, or says plainly that a link named one this market doesn't have. With
 * `untradable`, an instrument that doesn't trade (an index) shows that instead: a book or a tape has nothing for it.
 */
export function Known({
  symbol,
  untradable,
  children,
}: {
  symbol: string;
  untradable?: ReactNode;
  children: (inst: Instrument) => ReactNode;
}) {
  const inst = useMarket().instrument(symbol);
  if (!inst)
    return (
      <Empty
        icon={<QuestionIcon size={20} aria-hidden />}
        title={`No instrument called ${symbol || "that"}`}
      >
        Pick one from a watchlist, or press / to search.
      </Empty>
    );
  if (untradable && !facts(inst).tradable) return <>{untradable}</>;
  return <>{children(inst)}</>;
}
