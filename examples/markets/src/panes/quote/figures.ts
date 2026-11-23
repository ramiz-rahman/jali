/** A quote's key figures, by what the instrument is: each class says what matters about it. */
import type { Instrument, Quote } from "../../market/types";
import * as f from "../../ui/format";
import type { Figure } from "../../ui/molecules/Figures";

export interface YearRange {
  low: number;
  high: number;
}

const years = (maturity: number) =>
  maturity < 1 ? `${Math.round(maturity * 12)} months` : `${maturity} years`;

export function figures(inst: Instrument, q: Quote, year: YearRange | null): Figure[] {
  const p = (x: number) => f.price(inst, x);
  const yearRange: Figure = [
    "52-week range",
    year ? `${p(year.low)} – ${p(year.high)}` : "Loading…",
  ];
  const session: Figure[] = [
    ["Open", p(q.open)],
    ["Prev close", p(q.prevClose)],
  ];
  switch (inst.assetClass) {
    case "crypto":
      return [
        ["24h ago", p(q.prevClose)],
        ["24h volume", `${f.size(q.volume)} ${inst.base}`],
        ["24h VWAP", p(q.vwap)],
        ["Quoted in", inst.currency],
        yearRange,
        ["Source", `${inst.source ?? "The feed"}, live`],
      ];
    case "equity":
      return [
        ...session,
        ["Volume", f.size(q.volume)],
        ["VWAP", p(q.vwap)],
        ["Market value", f.size(q.last * inst.shares)],
        ["Sector", inst.sector],
        yearRange,
      ];
    case "govt":
    case "corp":
      return [
        ...session,
        ["Coupon", `${inst.coupon.toFixed(3)}%`],
        ["Maturity", years(inst.maturity)],
        ["Volume", f.size(q.volume)],
        ["Issuer", inst.issuer],
        yearRange,
      ];
    case "fx":
      return [
        ...session,
        ["Volume", `${f.size(q.volume)} ${inst.base}`],
        ["Quoted in", inst.currency],
        yearRange,
      ];
    case "index":
      return [
        ...session,
        ["Members", String(inst.members.length)],
        ["Tracks", inst.tracks],
        yearRange,
      ];
  }
}
