/** Made-up headlines: about one company (often after its shares move), or about the market as a whole. */
import type { Random } from "./random";
import type { Instrument } from "./types";

export interface Draft {
  title: string;
  body: string;
  source: string;
  symbols: string[];
}

const SOURCES = ["Meridian Wire", "Desk Notes", "Ledger Daily", "Market Brief"];

const pct = (r: Random, lo: number, hi: number) => `${r.int(lo, hi)}%`;

/** After a sharp move: a headline that explains it, in the direction it went. */
export function moveHeadline(r: Random, inst: Instrument, up: boolean): Draft {
  const n = inst.name;
  const title = up
    ? r.pick([
        `${n} jumps as orders beat forecasts`,
        `${n} rises after analysts lift their target`,
        `${n} climbs on talk of a larger buyback`,
        `${n} gains after winning a multi-year contract`,
      ])
    : r.pick([
        `${n} slides after cutting its outlook`,
        `${n} falls as a key customer delays orders`,
        `${n} drops after a broker downgrade`,
        `${n} weakens on margin worries`,
      ]);
  const body = up
    ? `Trading in ${inst.symbol} picked up sharply; volume is running ahead of its daily average.`
    : `Sellers moved early in ${inst.symbol}; the shares are among the session's weakest.`;
  return { title, body, source: r.pick(SOURCES), symbols: [inst.symbol] };
}

/** A headline from the day's flow: company news, rates, currencies or the market. */
export function flowHeadline(r: Random, instruments: readonly Instrument[]): Draft {
  const equities = instruments.filter((i) => i.assetClass === "equity");
  const company = r.pick(equities);
  const other = r.pick(equities.filter((e) => e.group !== company.group));
  const fx = r.pick(instruments.filter((i) => i.assetClass === "fx"));
  const kind = r.int(0, 9);
  if (kind <= 4) {
    const n = company.name;
    const options: Draft[] = [
      {
        title: `${n} names a new chief financial officer`,
        body: `The appointment takes effect next quarter. ${company.symbol} said guidance is unchanged.`,
        source: r.pick(SOURCES),
        symbols: [company.symbol],
      },
      {
        title: `${n} to present at an investor day next week`,
        body: `Management is expected to update its medium-term targets.`,
        source: r.pick(SOURCES),
        symbols: [company.symbol],
      },
      {
        title: `${n} and ${other.name} agree a supply partnership`,
        body: `Terms were not disclosed. The deal runs for ${r.int(3, 7)} years.`,
        source: r.pick(SOURCES),
        symbols: [company.symbol, other.symbol],
      },
      {
        title: `${n} plans to cut ${pct(r, 3, 9)} of its workforce`,
        body: `The company expects savings to show in next year's results.`,
        source: r.pick(SOURCES),
        symbols: [company.symbol],
      },
      {
        title: `${n} raises its dividend by ${pct(r, 4, 12)}`,
        body: `The board also extended its share buyback programme.`,
        source: r.pick(SOURCES),
        symbols: [company.symbol],
      },
    ];
    return r.pick(options);
  }
  if (kind <= 6)
    return r.pick<Draft>([
      {
        title: `Government 10-year yield ${r.pick(["edges higher", "slips"])} ahead of the auction`,
        body: `Dealers expect solid demand at the ${r.int(20, 45)}bn sale.`,
        source: r.pick(SOURCES),
        symbols: ["GOV10Y"],
      },
      {
        title: `Central bank holds rates and signals patience`,
        body: `Two-year yields moved most as traders trimmed bets on a cut this year.`,
        source: r.pick(SOURCES),
        symbols: ["GOV2Y", "GOV10Y"],
      },
      {
        title: `Inflation data due Thursday is the week's main test`,
        body: `Economists expect the core rate to ease by a tenth.`,
        source: r.pick(SOURCES),
        symbols: [],
      },
    ]);
  if (kind <= 7)
    return {
      title: `${fx.name} ${r.pick(["steady", "firmer", "softer"])} as traders await the jobs report`,
      body: `Options show traders paying up for protection into Friday.`,
      source: r.pick(SOURCES),
      symbols: [fx.symbol],
    };
  return r.pick<Draft>([
    {
      title: `Meridian 40 on track for a third weekly gain`,
      body: `Breadth is narrow: ${r.int(9, 16)} of the 40 shares account for most of the rise.`,
      source: r.pick(SOURCES),
      symbols: ["MX40"],
    },
    {
      title: `Energy shares lead as oil prices firm`,
      body: `Supply worries returned after weekend talks ended without a deal.`,
      source: r.pick(SOURCES),
      symbols: ["MXRES", "TDLN", "PTRX"],
    },
    {
      title: `Technology shares mixed after a chipmaker's warning`,
      body: `Investors are weighing slower orders against strong cloud spending.`,
      source: r.pick(SOURCES),
      symbols: ["MXTEC"],
    },
  ]);
}
