/**
 * The instruments of a made-up market: every company, ticker, issuer and index here is fictional. Prices, sizes and
 * volatilities are set to look like a real market's, so the demo reads true without anyone's data or licence.
 */
import type { Instrument } from "./types";

type EquityRow = [symbol: string, name: string, price: number, vol: number, sharesM: number];

const SECTORS: Record<string, EquityRow[]> = {
  Technology: [
    ["LMNA", "Lumina Systems", 182.4, 0.38, 2400],
    ["QBTL", "Qubitline", 64.12, 0.55, 610],
    ["ORBD", "Orbital Data", 241.85, 0.36, 1150],
    ["HLXS", "Helix Semiconductor", 97.33, 0.48, 1820],
    ["CRSW", "Crosswire Networks", 38.7, 0.34, 930],
    ["PXLR", "Pixelry", 21.94, 0.52, 480],
    ["NIMB", "Nimbus Cloud", 146.2, 0.42, 860],
    ["VTRA", "Vantara Software", 73.58, 0.4, 720],
  ],
  Financials: [
    ["HRBK", "Harbour Bank", 52.1, 0.24, 3100],
    ["LDGR", "Ledgerline", 31.45, 0.3, 1240],
    ["CPST", "Capstone Mutual", 88.6, 0.22, 640],
    ["MRNT", "Meridian Trust", 44.25, 0.23, 1580],
    ["FNCH", "Finch Payments", 119.3, 0.33, 520],
    ["SLVR", "Silverfield Insurance", 67.8, 0.21, 410],
    ["BRKW", "Brookwater Capital", 23.15, 0.29, 870],
  ],
  "Health care": [
    ["CLVR", "Clover Therapeutics", 58.9, 0.46, 390],
    ["ADNA", "Adena Biosciences", 112.4, 0.41, 450],
    ["PLSE", "Pulse Medical", 76.25, 0.27, 980],
    ["MNTH", "Monarch Health", 39.6, 0.24, 1720],
    ["GNVA", "Genova Labs", 204.1, 0.35, 310],
    ["CRDX", "Cardex Devices", 27.85, 0.39, 260],
    ["SANO", "Sanora Pharma", 91.7, 0.26, 1460],
  ],
  Energy: [
    ["TDLN", "Tideline Energy", 46.3, 0.31, 2050],
    ["SLRK", "Solark Renewables", 18.65, 0.47, 690],
    ["PTRX", "Petrex", 71.2, 0.33, 1330],
    ["GRDL", "Gridline Utilities", 34.8, 0.19, 1150],
    ["WNDM", "Windmere Power", 25.4, 0.36, 540],
    ["BSLT", "Basalt Resources", 59.15, 0.38, 760],
  ],
  Consumer: [
    ["HRTH", "Hearth & Co", 84.5, 0.22, 1270],
    ["BLMS", "Bloomside Retail", 29.95, 0.31, 880],
    ["KTLR", "Kettler Foods", 41.2, 0.18, 1040],
    ["VYGE", "Voyage Travel", 17.4, 0.44, 720],
    ["MSTL", "Mistral Apparel", 63.75, 0.32, 350],
    ["CRMB", "Crumb Bakeries", 12.85, 0.37, 290],
  ],
  Industrials: [
    ["ANVL", "Anvil Works", 128.6, 0.25, 840],
    ["KSTR", "Kestrel Aerospace", 157.9, 0.3, 610],
    ["RLWY", "Railway Holdings", 48.35, 0.21, 1090],
    ["FRGE", "Forge Robotics", 36.2, 0.45, 430],
    ["CNVY", "Convoy Logistics", 22.7, 0.34, 560],
    ["STRT", "Strata Materials", 54.45, 0.28, 700],
  ],
};

const equities: Instrument[] = Object.entries(SECTORS).flatMap(([group, rows]) =>
  rows.map(([symbol, name, prevClose, vol, sharesM]) => ({
    symbol,
    name,
    assetClass: "equity" as const,
    group,
    currency: "USD",
    decimals: 2,
    tick: 0.01,
    prevClose,
    vol,
    shares: sharesM * 1e6,
  })),
);

// Government bonds along the curve: a bill and four coupon bonds. `vol` is the yield's daily move in bp.
type BondRow = [
  symbol: string,
  name: string,
  maturity: number,
  coupon: number,
  prevYield: number,
  vol: number,
];
const GOVTS: BondRow[] = [
  ["GOV3M", "Government 3-month bill", 0.25, 0, 4.18, 3],
  ["GOV2Y", "Government 2-year", 2, 3.75, 3.92, 7],
  ["GOV5Y", "Government 5-year", 5, 3.5, 3.71, 7.5],
  ["GOV10Y", "Government 10-year", 10, 3.875, 3.96, 7],
  ["GOV30Y", "Government 30-year", 30, 4.25, 4.34, 6.5],
];
const CORPS: BondRow[] = [
  ["HRBK29", "Harbour Bank 4.5% 2029", 3, 4.5, 4.71, 8],
  ["KSTR32", "Kestrel Aerospace 5% 2032", 6, 5, 5.12, 9],
  ["TDLN36", "Tideline Energy 5.25% 2036", 10, 5.25, 5.48, 9],
];

const bond =
  (assetClass: "govt" | "corp", group: string) =>
  ([symbol, name, maturity, coupon, prevYield, vol]: BondRow): Instrument => ({
    symbol,
    name,
    assetClass,
    group,
    currency: "USD",
    decimals: 3,
    tick: 0.001,
    prevClose: bondPrice(prevYield, coupon, maturity),
    vol,
    coupon,
    maturity,
    prevYield,
  });

const bonds = [...GOVTS.map(bond("govt", "Government")), ...CORPS.map(bond("corp", "Corporate"))];

// Real currency codes (a currency is nobody's product); the rates are simulated.
type FxRow = [symbol: string, name: string, price: number, vol: number, decimals: number];
const FX: FxRow[] = [
  ["EURUSD", "Euro / US dollar", 1.08423, 0.075, 5],
  ["GBPUSD", "Pound / US dollar", 1.26754, 0.082, 5],
  ["USDJPY", "US dollar / Yen", 151.324, 0.095, 3],
  ["USDCHF", "US dollar / Swiss franc", 0.88213, 0.078, 5],
  ["AUDUSD", "Australian dollar / US dollar", 0.65841, 0.1, 5],
  ["USDCAD", "US dollar / Canadian dollar", 1.36118, 0.062, 5],
];
const fx: Instrument[] = FX.map(([symbol, name, prevClose, vol, decimals]) => ({
  symbol,
  name,
  assetClass: "fx",
  group: "Major",
  currency: symbol.slice(3),
  decimals,
  tick: 10 ** -decimals,
  prevClose,
  vol,
}));

const inSector = (...groups: string[]) =>
  equities.filter((e) => groups.includes(e.group)).map((e) => e.symbol);

// Indices are made of the equities above, weighted by market value, so they move with them.
const indices: Instrument[] = [
  ["MX40", "Meridian 40", 4812.33, equities.map((e) => e.symbol), "All 40 shares"],
  ["MXTEC", "Meridian Technology", 1935.7, inSector("Technology"), "Technology"],
  ["MXFIN", "Meridian Financials", 802.14, inSector("Financials"), "Financials"],
  [
    "MXRES",
    "Meridian Resources",
    1266.48,
    inSector("Energy", "Industrials"),
    "Energy, industrials",
  ],
].map(([symbol, name, prevClose, members, group]) => ({
  symbol: symbol as string,
  name: name as string,
  assetClass: "index",
  group: group as string,
  currency: "USD",
  decimals: 2,
  tick: 0.01,
  prevClose: prevClose as number,
  vol: 0,
  members: members as string[],
}));

export const INSTRUMENTS: readonly Instrument[] = [...equities, ...bonds, ...fx, ...indices];

export const SECTOR_NAMES = Object.keys(SECTORS);

/** A bond's clean price per 100 from its yield (annual coupons; a bill is a zero). */
export function bondPrice(yieldPct: number, coupon: number, maturity: number): number {
  const y = yieldPct / 100;
  const whole = Math.floor(maturity);
  const frac = maturity - whole;
  let pv = 100 / (1 + y) ** maturity;
  // Coupons fall at frac, frac+1, … maturity years from now.
  for (let i = 0; i < whole + (frac > 0 ? 1 : 0); i++) {
    const t = frac > 0 ? frac + i : i + 1;
    if (t > maturity + 1e-9) break;
    pv += coupon / (1 + y) ** t;
  }
  return pv;
}
