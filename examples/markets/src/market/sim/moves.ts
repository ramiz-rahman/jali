/**
 * One step of a simulated price. Each step draws shocks the whole market shares (the market, each sector, the curve's
 * level and slope, the dollar), and each class moves on its own mix of them. An index doesn't move here: it is its
 * members, once they have moved (index.ts).
 */
import type { HeadlineDraft } from "./news";
import { moveHeadline } from "./news";
import { bondPrice } from "./instruments";
import { YEAR_S, SESSION_S, type Live } from "./live";
import type { Random } from "./random";

export interface Shocks {
  market: number;
  sector: Map<string, number>;
  curveLevel: number;
  curveSlope: number;
  dollar: number;
}

export function drawShocks(r: Random, sectors: readonly string[]): Shocks {
  return {
    market: r.gauss(),
    sector: new Map(sectors.map((s) => [s, r.gauss()])),
    curveLevel: r.gauss(),
    curveSlope: r.gauss(),
    dollar: r.gauss(),
  };
}

/** Moves `l`'s mid (a bond's yield, and its price from it) by one step of `dt` seconds. Now and then a share moves
 *  sharply, and returns the headline that explains it. */
export function move(l: Live, s: Shocks, dt: number): HeadlineDraft | undefined {
  const { inst } = l;
  switch (inst.assetClass) {
    case "equity": {
      const sigma = inst.vol * Math.sqrt(dt / YEAR_S);
      let ret =
        sigma * (0.5 * s.market + 0.4 * (s.sector.get(inst.sector) ?? 0) + 0.768 * l.r.gauss());
      let headline: HeadlineDraft | undefined;
      if (l.r.next() < dt / (3600 * 5)) {
        const up = l.r.next() < 0.5;
        ret += (up ? 1 : -1) * (0.005 + l.r.next() * 0.01);
        headline = moveHeadline(l.r, inst, up);
      }
      l.mid *= Math.exp(ret);
      return headline;
    }
    case "govt":
    case "corp": {
      // Yields: the curve moves as a whole, the ends a little apart, each bond a little on its own.
      const slope = Math.max(-1, Math.min(1, Math.log(inst.maturity / 5) / Math.log(6)));
      const bp = inst.vol * Math.sqrt(dt / SESSION_S);
      const shock = -(0.8 * s.curveLevel + 0.4 * slope * s.curveSlope + 0.45 * l.r.gauss());
      l.yld -= (bp * shock) / 100;
      l.mid = bondPrice(l.yld, inst.coupon, inst.maturity);
      return undefined;
    }
    case "fx": {
      const sigma = inst.vol * Math.sqrt(dt / YEAR_S);
      // The dollar's move: a pair priced in dollars falls as it rises.
      const usdFirst = inst.base === "USD" ? 1 : -1;
      l.mid *= Math.exp(sigma * (0.6 * usdFirst * s.dollar + 0.8 * l.r.gauss()));
      return undefined;
    }
    case "index":
      return undefined;
  }
}
