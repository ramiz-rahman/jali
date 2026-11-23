/**
 * Wi-Fi channel analysis: where each network sits in the spectrum, how much of a candidate channel it overlaps,
 * how congested each band is, and which channel to move to, with the reasoning as sentences the pane prints.
 *
 * The model, and where it is deliberately simple:
 * - A network occupies a span of MHz: its channel's centre, spread by its width. 2.4 GHz channels are 5 MHz apart
 *   and 20 MHz wide, so they overlap a lot (only 1, 6 and 11 are clear of each other). 5 and 6 GHz channels are
 *   20 MHz apart and bond into 40/80/160 MHz blocks aligned to fixed boundaries.
 * - A neighbour costs a candidate in proportion to how much of the narrower of the two it overlaps (a bonded
 *   channel must hear every one of its 20 MHz parts idle, so a 20 MHz neighbour inside an 80 MHz block blocks it
 *   fully) and to how loud the neighbour is. Partial overlap costs 25% more than the same overlap would as
 *   co-channel, because overlapping neighbours cannot decode each other's preambles to take turns.
 * - Your own network is left out of the score: moving it takes it away.
 * It does not know your country's allowed channels, radar events, or how much traffic each neighbour carries.
 */
import { centreMHz } from "./net";
import type { Band, WifiNetwork } from "./types";

export interface Span {
  lowMHz: number;
  highMHz: number;
  widthMHz: number;
}

const GROUPS_5: [number, number][] = [
  [36, 64],
  [100, 144],
  [149, 165],
];
const CH_6_MAX = 233;

/** 5 GHz channels 52 to 144 are DFS: shared with weather and military radar. */
export const isDfs = (channel: number): boolean => channel >= 52 && channel <= 144;
/** 6 GHz preferred scanning channels: every 16th from 5, which clients probe first. */
export const isPsc = (channel: number): boolean => (channel - 5) % 16 === 0;

export interface Block {
  band: Band;
  /** First (lowest) 20 MHz channel of the block, which is also the primary the router is told. */
  primary: number;
  /** Last 20 MHz channel in the block. */
  last: number;
  widthMHz: number;
  span: Span;
  dfs: boolean;
}

const makeBlock = (band: Band, primary: number, widthMHz: number): Block => {
  const n = widthMHz / 20;
  const last = primary + 4 * (n - 1);
  return {
    band,
    primary,
    last,
    widthMHz,
    span: { lowMHz: centreMHz(band, primary) - 10, highMHz: centreMHz(band, last) + 10, widthMHz },
    dfs: band === "5" && Array.from({ length: n }, (_, i) => primary + 4 * i).some(isDfs),
  };
};

/** Every valid block of a width in a band. 2.4 GHz is just channels 1 to 13 at 20 MHz. */
export function blocks(band: Band, widthMHz: number): Block[] {
  const n = widthMHz / 20;
  const out: Block[] = [];
  if (band === "2.4") {
    if (widthMHz === 20) for (let c = 1; c <= 13; c++) out.push(makeBlock(band, c, 20));
    return out;
  }
  const ranges: [number, number][] = band === "5" ? GROUPS_5 : [[1, CH_6_MAX]];
  for (const [from, to] of ranges) {
    for (let s = from; s + 4 * (n - 1) <= to; s += 4 * n) out.push(makeBlock(band, s, widthMHz));
  }
  return out;
}

/** The widths a band's blocks come in. */
export const WIDTHS: Record<Band, number[]> = {
  "2.4": [20],
  "5": [20, 40, 80, 160],
  "6": [20, 40, 80, 160],
};

/** The span a network occupies, or undefined when its channel is unknown. */
export function spanOf(n: Pick<WifiNetwork, "band" | "channel" | "widthMHz">): Span | undefined {
  if (n.band === undefined || n.channel === undefined) return undefined;
  const width = n.widthMHz ?? 20;
  if (n.band === "2.4") {
    // A 40 MHz network's second 20 MHz sits above the primary on channels 1 to 6 and below it from 7 up: the usual
    // choice, which a scan does not report.
    const c = centreMHz("2.4", n.channel) + (width >= 40 ? (n.channel <= 6 ? 10 : -10) : 0);
    return { lowMHz: c - width / 2, highMHz: c + width / 2, widthMHz: width };
  }
  const block = blocks(n.band, width).find(
    (b) => n.channel !== undefined && n.channel >= b.primary && n.channel <= b.last,
  );
  if (block) return block.span;
  const c = centreMHz(n.band, n.channel);
  return { lowMHz: c - width / 2, highMHz: c + width / 2, widthMHz: width };
}

export const overlapMHz = (a: Span, b: Span): number =>
  Math.max(0, Math.min(a.highMHz, b.highMHz) - Math.max(a.lowMHz, b.lowMHz));

/** Louder neighbours hurt more: 1.0 at -45 dBm and stronger, fading to almost nothing at -95. Unknown counts half. */
export const signalWeight = (dbm: number | undefined): number =>
  dbm === undefined ? 0.5 : Math.min(1, Math.max(0.05, (dbm + 95) / 50));

export interface Candidate {
  block: Block;
  /** Sum of weighted overlaps: 0 is empty air, 1 is about one strong co-channel neighbour. */
  load: number;
  /** load as 0 to 100. */
  congestion: number;
  /** How many networks overlap at all. */
  neighbours: number;
  /** The loudest of them, dBm. */
  strongest?: number;
}

export const congestionOf = (load: number): number => Math.round(100 * (1 - Math.exp(-load / 1.5)));

export type CongestionLabel = "Clear" | "Light" | "Busy" | "Congested";
export const congestionLabel = (congestion: number): CongestionLabel =>
  congestion < 15 ? "Clear" : congestion < 40 ? "Light" : congestion < 65 ? "Busy" : "Congested";

/** How badly the networks in `others` crowd a block. `others` should exclude the network being moved. */
export function scoreBlock(block: Block, others: WifiNetwork[]): Candidate {
  let load = 0;
  let neighbours = 0;
  let strongest: number | undefined;
  for (const o of others) {
    const span = spanOf(o);
    if (!span || o.band !== block.band) continue;
    const overlap = overlapMHz(block.span, span);
    if (overlap <= 0) continue;
    const narrower = Math.min(block.span.widthMHz, span.widthMHz);
    const frac = Math.min(1, overlap / narrower);
    const partial = overlap < narrower ? 1.25 : 1;
    load += signalWeight(o.signalDbm) * frac * partial;
    neighbours++;
    if (o.signalDbm !== undefined && (strongest === undefined || o.signalDbm > strongest))
      strongest = o.signalDbm;
  }
  return { block, load, congestion: congestionOf(load), neighbours, strongest };
}

export interface Recommendation {
  band: Band;
  /** The width the ranking is for: your current width, or the usual one for the band. */
  widthMHz: number;
  best: Candidate;
  /** Top candidates at this width, best first. */
  ranked: Candidate[];
  /** The best block at each width the band offers, for the speed-against-room comparison. */
  byWidth: Candidate[];
  /** Your current channel's score, when your network is in this band. */
  current?: Candidate;
  /** You are already on the best one (or within a hair of it). */
  alreadyBest: boolean;
  reasons: string[];
}

export interface BandReport {
  band: Band;
  networks: WifiNetwork[];
  /** Congestion where you are (your channel, without you), or the average of the band's 20 MHz channels. */
  congestion: number;
  label: CongestionLabel;
  /** What `congestion` measures, in words. */
  basis: string;
  recommendation?: Recommendation;
}

const BAND_NAME: Record<Band, string> = { "2.4": "2.4 GHz", "5": "5 GHz", "6": "6 GHz" };
export const bandName = (b: Band): string => BAND_NAME[b];
export const BANDS: Band[] = ["2.4", "5", "6"];

const where = (c: Candidate): string =>
  c.block.primary === c.block.last
    ? `channel ${c.block.primary}`
    : `channels ${c.block.primary} to ${c.block.last}`;

const detail = (c: Candidate): string => {
  const who =
    c.neighbours === 0
      ? "no network overlaps"
      : `${c.neighbours} network${c.neighbours === 1 ? "" : "s"} overlap${c.neighbours === 1 ? "s" : ""}${
          c.strongest !== undefined ? `, the loudest at ${c.strongest} dBm` : ""
        }`;
  return `${who}, congestion ${c.congestion}%`;
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const describe = (c: Candidate): string => `${where(c)} (${c.block.widthMHz} MHz): ${detail(c)}`;

/** Rank by load; ties go to non-DFS, then preferred scanning channels (6 GHz), then the lower channel. */
const rank = (a: Candidate, b: Candidate): number =>
  a.load + (a.block.dfs ? 0.05 : 0) - (b.load + (b.block.dfs ? 0.05 : 0)) ||
  Number(isPsc(b.block.primary) && b.block.band === "6") -
    Number(isPsc(a.block.primary) && a.block.band === "6") ||
  a.block.primary - b.block.primary;

function recommend(band: Band, all: WifiNetwork[], mine: WifiNetwork | undefined): Recommendation {
  const others = all.filter((n) => n !== mine);
  const usual = band === "2.4" ? 20 : band === "5" ? 80 : 80;
  const widthMHz = mine?.widthMHz && WIDTHS[band].includes(mine.widthMHz) ? mine.widthMHz : usual;
  const scoreAll = (w: number) => blocks(band, w).map((b) => scoreBlock(b, others));
  // 2.4 GHz: only 1, 6 and 11 are candidates, whatever else is free.
  const forWidth = (w: number) => {
    const scored = scoreAll(w);
    return band === "2.4" ? scored.filter((c) => [1, 6, 11].includes(c.block.primary)) : scored;
  };
  const ranked = [...forWidth(widthMHz)].sort(rank);
  const best = ranked[0] as Candidate;
  const byWidth = WIDTHS[band]
    .map((w) => [...forWidth(w)].sort(rank)[0])
    .filter((c): c is Candidate => c !== undefined);
  const current =
    mine?.channel !== undefined && mine.band === band
      ? (() => {
          const span = spanOf(mine);
          const block =
            span &&
            blocks(band, mine.widthMHz ?? 20).find(
              (b) => b.span.lowMHz === span.lowMHz && b.span.highMHz === span.highMHz,
            );
          // 2.4 GHz is scored on its actual channel even when it is not 1, 6 or 11.
          const b = block ?? makeBlock(band, mine.channel, mine.widthMHz ?? 20);
          return scoreBlock(b, others);
        })()
      : undefined;
  const alreadyBest =
    current !== undefined &&
    current.load <= best.load + 0.05 &&
    (band !== "2.4" || [1, 6, 11].includes(current.block.primary));
  const reasons: string[] = [];

  if (band === "2.4") {
    reasons.push(
      "Channels are 5 MHz apart but each signal is about 20 MHz wide, so neighbours overlap across ±2 channels. Only 1, 6 and 11 sit clear of each other: any other channel overlaps two of them.",
    );
    for (const c of [...forWidth(20)].sort((a, b) => a.block.primary - b.block.primary))
      reasons.push(`Channel ${c.block.primary}: ${detail(c)}.`);
    if (current && ![1, 6, 11].includes(current.block.primary)) {
      reasons.push(
        `Your network is on channel ${current.block.primary}, which overlaps the neighbours on both sides. Move to the nearest of 1, 6 or 11.`,
      );
    }
    if (mine?.widthMHz && mine.widthMHz >= 40) {
      reasons.push(
        "You are on 40 MHz: that takes two of the three clean channels. Use 20 MHz here and leave the speed to 5 GHz.",
      );
    }
  } else if (band === "5") {
    reasons.push(
      `Ranking ${widthMHz} MHz blocks. A bonded channel can only transmit when every 20 MHz part of it is idle, so a neighbour anywhere inside the block blocks the whole thing.`,
    );
    reasons.push(`${cap(describe(best))}.`);
    if (best.block.dfs) {
      const nonDfs = ranked.find((c) => !c.block.dfs);
      reasons.push(
        `That block is on DFS channels (52 to 144): the router must listen for radar for about a minute before using it and leave if it hears any, which drops connections for a moment. Some older phones and IoT devices cannot join DFS channels at all.` +
          (nonDfs ? ` The best without DFS is ${describe(nonDfs)}.` : ""),
      );
    } else {
      reasons.push(
        "That block is outside DFS, so there is no radar wait and every client can join it.",
      );
    }
    if (byWidth.length > 1) {
      reasons.push(
        "Width trades range and interference for speed: " +
          byWidth
            .map(
              (c) =>
                `${c.block.widthMHz} MHz → congestion ${c.congestion}% (best at channel ${c.block.primary})`,
            )
            .join("; ") +
          ". Each doubling of width roughly doubles the peak rate, raises the noise floor by about 3 dB (so the same signal has less margin and the range shrinks), and gives neighbours twice the spectrum to collide with.",
      );
    }
    reasons.push(
      "Which channels you may use depends on your country's regulatory domain, which a scan cannot tell. Check the router's list.",
    );
  } else {
    reasons.push(
      `Ranking ${widthMHz} MHz blocks. 6 GHz has 59 channels of 20 MHz in the US (fewer in some regions), no legacy 802.11a/b/g/n devices and, for now, few neighbours, so wide channels usually work.`,
    );
    reasons.push(
      describe(best) +
        (isPsc(best.block.primary)
          ? ", which is a preferred scanning channel, so clients find it fast."
          : "."),
    );
    reasons.push(
      "6 GHz needs WPA3 (or OWE) and an 802.11ax/be client. Range is shorter than 5 GHz: higher frequencies lose more to walls.",
    );
  }
  if (best.neighbours === 0 && band !== "2.4")
    reasons.push("Nothing overlaps this block in what you scanned: it is as clear as it gets.");
  if (alreadyBest) reasons.push("You are already on the best one of these.");
  return {
    band,
    widthMHz,
    best,
    ranked: ranked.slice(0, 4),
    byWidth,
    current,
    alreadyBest,
    reasons,
  };
}

/** One report per band that has networks with a known channel. */
export function analyseWifi(networks: WifiNetwork[]): BandReport[] {
  const out: BandReport[] = [];
  for (const band of BANDS) {
    const inBand = networks.filter((n) => n.band === band && n.channel !== undefined);
    if (!inBand.length) continue;
    const mine = inBand.find((n) => n.current);
    const rec = recommend(band, inBand, mine);
    const here = rec.current;
    const congestion = here
      ? here.congestion
      : Math.round(
          blocks(band, 20)
            .filter((b) => band !== "2.4" || b.primary <= 11)
            .map((b) => scoreBlock(b, inBand).congestion)
            .reduce((s, c, _i, a) => s + c / a.length, 0),
        );
    out.push({
      band,
      networks: inBand,
      congestion,
      label: congestionLabel(congestion),
      basis: here
        ? "on your channel, without your own network"
        : "averaged over the band's channels",
      recommendation: rec,
    });
  }
  return out;
}

export type Tone = "ok" | "signal" | "flag" | "accent";
export interface Quality {
  label: string;
  tone: Tone;
  note: string;
}

/** What a received signal strength buys, with the usual thresholds (-67 dBm is the figure vendors give for video and voice). */
export function signalQuality(dbm: number): Quality {
  if (dbm >= -50)
    return {
      label: "Excellent",
      tone: "ok",
      note: "Close to the access point. Rates are limited by the standard, not the signal.",
    };
  if (dbm >= -60)
    return { label: "Good", tone: "ok", note: "Reliable for anything, including high-rate video." };
  if (dbm >= -67)
    return {
      label: "Fair",
      tone: "signal",
      note: "Enough for video calls and streaming: -67 dBm is the usual minimum for them.",
    };
  if (dbm >= -75)
    return {
      label: "Weak",
      tone: "flag",
      note: "Web and email work; rates drop and retries rise. Real-time traffic suffers.",
    };
  if (dbm >= -85)
    return {
      label: "Poor",
      tone: "accent",
      note: "Barely connected: the radio falls back to the slowest rates.",
    };
  return {
    label: "Unusable",
    tone: "accent",
    note: "At or near the receiver's sensitivity: it drops in and out.",
  };
}

/** Signal over noise, dB: what the radio needs for a given modulation. */
export function snrQuality(snrDb: number): Quality {
  if (snrDb >= 40)
    return {
      label: "Excellent",
      tone: "ok",
      note: "Enough for the densest modulation (1024-QAM).",
    };
  if (snrDb >= 25) return { label: "Good", tone: "ok", note: "Supports 256-QAM and high rates." };
  if (snrDb >= 15)
    return {
      label: "Fair",
      tone: "signal",
      note: "Mid-rate modulation; expect retries under load.",
    };
  if (snrDb >= 10)
    return { label: "Poor", tone: "flag", note: "Only the robust, slow modulations hold up." };
  return {
    label: "Bad",
    tone: "accent",
    note: "Signal is close to the noise: little will get through.",
  };
}

/** `n.ssid`, or what to call a network with no name. */
export const nameOf = (n: WifiNetwork): string =>
  n.ssid ? n.ssid : n.redacted ? "Hidden by macOS" : "Hidden network";
