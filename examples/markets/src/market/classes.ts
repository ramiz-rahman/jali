/**
 * What each asset class is, in one table: the panes, commands and paper book ask it rather than testing the class
 * themselves. A new class is a new row here (and a case in each typed `switch` over `assetClass`, which the compiler
 * points to).
 */
import type { AssetClass, Bond, Instrument } from "./types";

interface ClassFacts {
  /** Its name beside an instrument: "Government bond". */
  label: string;
  /** It has an order book and a tape, and can be ordered. An index is a measure of its members, not a thing to buy. */
  tradable: boolean;
  /** It trades around the clock: its "today" is the last 24 hours (crypto). */
  continuous: boolean;
  /** Its volume means something in a list: an index has none of its own, and spot FX's is notional. */
  showsVolume: boolean;
}

export const CLASSES: Record<AssetClass, ClassFacts> = {
  equity: { label: "Equity", tradable: true, continuous: false, showsVolume: true },
  govt: { label: "Government bond", tradable: true, continuous: false, showsVolume: true },
  corp: { label: "Corporate bond", tradable: true, continuous: false, showsVolume: true },
  fx: { label: "FX spot", tradable: true, continuous: false, showsVolume: false },
  index: { label: "Index", tradable: false, continuous: false, showsVolume: false },
  crypto: { label: "Crypto", tradable: true, continuous: true, showsVolume: true },
};

export const facts = (inst: Instrument): ClassFacts => CLASSES[inst.assetClass];

export const isBond = (inst: Instrument): inst is Bond =>
  inst.assetClass === "govt" || inst.assetClass === "corp";

/** The instruments that can be ordered, and have a book and a tape. */
export const tradable = (instruments: readonly Instrument[]) =>
  instruments.filter((i) => facts(i).tradable);
