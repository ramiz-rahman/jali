/**
 * The real instruments of the live feed: ten crypto pairs against the US dollar, as Kraken lists them. The decimals
 * and ticks are Kraken's (from its public AssetPairs), so a price shows exactly as the exchange quotes it.
 */
import type { Instrument } from "./types";

type PairRow = [symbol: string, pair: string, name: string, decimals: number];

const PAIRS: PairRow[] = [
  ["BTCUSD", "BTC/USD", "Bitcoin", 1],
  ["ETHUSD", "ETH/USD", "Ether", 2],
  ["SOLUSD", "SOL/USD", "Solana", 2],
  ["XRPUSD", "XRP/USD", "XRP", 5],
  ["ADAUSD", "ADA/USD", "Cardano", 6],
  ["DOGEUSD", "DOGE/USD", "Dogecoin", 7],
  ["LTCUSD", "LTC/USD", "Litecoin", 2],
  ["LINKUSD", "LINK/USD", "Chainlink", 5],
  ["AVAXUSD", "AVAX/USD", "Avalanche", 3],
  ["DOTUSD", "DOT/USD", "Polkadot", 4],
];

export const CRYPTO_SYMBOLS: readonly string[] = PAIRS.map(([symbol]) => symbol);

/** Kraken's name for a pair ("BTC/USD"), from the app's symbol ("BTCUSD"). */
export const krakenPair = (symbol: string) => PAIRS.find((p) => p[0] === symbol)?.[1];

/** Fresh instruments, each time: the live feed sets `prevClose` on them from its first quote. */
export function cryptoInstruments(): Instrument[] {
  return PAIRS.map(([symbol, , name, decimals]) => ({
    symbol,
    name,
    assetClass: "crypto",
    group: "Crypto",
    currency: "USD",
    decimals,
    tick: 10 ** -decimals,
    prevClose: 0,
    vol: 0,
    source: "Kraken",
    continuous: true,
  }));
}
