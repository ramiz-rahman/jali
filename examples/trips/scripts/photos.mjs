#!/usr/bin/env node
/**
 * Fetches the trip's photos from Wikimedia Commons and writes them into the app:
 *
 *   public/photos/<id>.webp     1200 pixels wide, for a place's hero
 *   public/photos/<id>-s.webp   440 pixels wide, for lists and the map
 *   src/trip/photos.ts          each photo's size, tone, alt text, credit and licence
 *
 * Every file is chosen by hand below, from Commons, under a licence that allows reuse with credit (CC0, public
 * domain, CC BY, CC BY-SA). The script checks each licence again and refuses anything else. A real sight gets a photo
 * of itself. A made-up hotel or restaurant gets a stand-in: a photo of the kind of room, view or dish it offers, and
 * the app says so wherever it shows one.
 *
 * Needs `vips` and `cwebp` (Homebrew: `brew install vips webp`). Run from this folder: `node scripts/photos.mjs`.
 * Photos already in public/photos are kept; pass --force to fetch them all again.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(here, "public/photos");
const DATA = join(here, "src/trip/photos.ts");
const force = process.argv.includes("--force");
const UA = { "User-Agent": "jali-trips-example-photos/1.0 (open-source example app)" };
const ALLOWED = /^(CC0|Public domain|PD|CC BY(-SA)?( \d\.\d)?)$/i;

/**
 * id: a place's id (src/trip/places.ts) or a city cover. `standIn` is shown with a made-up business's photo. `focus`
 * is the CSS object-position that keeps the subject in frame when the photo is cropped.
 */
const SOURCES = {
  "cover-bkk": {
    file: "Bangkok skytrain sunset.jpg",
    alt: "Bangkok's towers and the Skytrain at sunset",
  },
  "cover-hkt": {
    file: "Banana beach Phuket 2017 - 01.jpg",
    alt: "Rocks and surf on a Phuket beach at dusk",
  },

  // Bangkok
  "grand-palace": {
    file: "Phra Thinang Chakri Maha Prasat (II) BKK.jpg",
    alt: "The Chakri Maha Prasat hall of the Grand Palace, its three spired roofs against a blue sky",
  },
  "wat-pho": {
    file: "Wat Pho, Bangkok, Tailandia, 2013-08-22, DD 06.jpg",
    alt: "The gilded Reclining Buddha of Wat Pho, seen along its length",
    focus: "50% 55%",
  },
  "wat-arun": {
    file: "Lascar View from the central prang - Wat Arun (4509726010).jpg",
    alt: "A tiled prang of Wat Arun above the Chao Phraya, with the old city across the river",
  },
  "museum-siam": {
    file: "Museum Siam (I).jpg",
    alt: "Museum Siam's colonnaded yellow building behind a lawn",
  },
  "pak-khlong": {
    file: "Marigold garlands, Pak Khlong Talat flower market Bangkok.jpg",
    alt: "Orange marigold garlands hanging in rows at the flower market",
    focus: "50% 40%",
  },
  "national-museum": {
    file: "Bangkok National Museum.jpg",
    alt: "A Thai pavilion with tiered roofs at the Bangkok National Museum",
  },
  "giant-swing": {
    file: "The Giant Swing (เสาชิงช้า, Sao Ching Cha).jpg",
    alt: "The tall red frame of the Giant Swing in front of Wat Suthat",
    focus: "60% 50%",
  },
  "golden-mount": {
    file: "Wat Saket, Golden Mount, Bangkok, Thailand.jpg",
    alt: "The golden chedi on top of the Golden Mount",
  },
  "khao-san": {
    file: "ถนนข้าวสารในเวลากลางคืน ๑ - Khaosan Road at night 1.jpg",
    alt: "Khao San Road at night, crowded under neon signs",
  },
  "marble-temple": {
    file: "Wat Benchamabophit Thailand.jpg",
    alt: "The white marble ordination hall of Wat Benchamabophit with red and gold roofs",
  },
  "wat-traimit": {
    file: "2016 Bangkok, Dystrykt Samphanthawong, Wat Traimit Witthayaram (22).jpg",
    alt: "The solid gold seated Buddha of Wat Traimit",
    focus: "50% 40%",
  },
  yaowarat: {
    file: "2016 Bangkok, Dystrykt Samphanthawong, Ulica Yaowarat (05).jpg",
    alt: "Yaowarat Road's shophouses hung with red and gold Chinese signs",
  },
  "talat-noi": {
    file: "Rong Kuak Shrine Talat Noi ศาลเจ้าโรงเกือก ตลาดน้อย 2021 June.jpg",
    alt: "The red Rong Kuak Chinese shrine among Talat Noi's old buildings",
  },
  "jim-thompson": {
    file: "JT House - Jim Thompson House, Bangkok - Thailand - panoramio.jpg",
    alt: "A red teak house among tropical plants at the Jim Thompson House",
    focus: "50% 35%",
  },
  erawan: {
    file: "Dance offering at Erawan Shrine, Bangkok (32844253793).jpg",
    alt: "Dancers in gold costumes performing an offering at the Erawan Shrine",
  },
  lumphini: {
    file: "Lumphini Park (I).jpg",
    alt: "Lumphini Park's lake with Bangkok's towers rising behind the trees",
  },
  chatuchak: {
    file: "Chatuchak Weekend Market 2.jpg",
    alt: "A narrow aisle of colourful stalls at Chatuchak market",
  },
  "bkk-airport": {
    file: "Suvarnabhumi Airport Terminal C interior (I).jpg",
    alt: "The curved glass and steel roof over Suvarnabhumi's concourse",
  },

  // Phuket
  "old-town": {
    file: "Thalang Road 2.jpg",
    alt: "Pastel Sino-Portuguese shophouses on Thalang Road",
    focus: "50% 45%",
  },
  "khao-rang": {
    file: "Phuket Town from Rang Hill.jpg",
    alt: "Phuket Town spread out below Rang Hill, with the sea beyond",
  },
  "wat-chalong": {
    file: "Phuket Thailand Wat-Chalong-01.jpg",
    alt: "Wat Chalong's ordination hall with red, layered roofs",
  },
  "big-buddha": {
    file: "The Big Buddha, Phuket.jpg",
    alt: "The white marble Big Buddha seated on the ridge under a blue sky",
    focus: "50% 30%",
  },
  promthep: {
    file: "Beautiful Sunset on Promthep Cape, Phuket island, Thailand.jpg",
    alt: "Palm trees silhouetted against an orange sunset at Promthep Cape",
  },
  "nai-harn": {
    file: "Nai harn beach phuket (63).jpg",
    alt: "Turquoise water and white sand at Nai Harn, with a green headland",
  },
  // The file page names no author; its uploader is credited.
  "kata-view": {
    file: "Phuket Viewpoint.jpg",
    alt: "Three bays seen from the Karon Viewpoint: Kata Noi, Kata and Karon",
    credit: "Oberpepe",
  },
  "kata-beach": {
    file: "Kata Beach1.jpg",
    alt: "Longtail boats moored in the clear shallows of Kata Beach",
  },
  "karon-beach": {
    file: "Karon Beach,Phuket (21).jpg",
    alt: "Waves running up the long sand of Karon Beach",
  },
  patong: {
    file: "Patong Beach Phuket November 2012.jpg",
    alt: "Patong Bay with longtail boats and green hills behind",
  },
  bangla: { file: "Bangla Road.JPG", alt: "Bangla Road at night, lit by bar signs" },
  kamala: { file: "Thaïlande 2010 248.jpg", alt: "A quiet curve of Kamala Beach under trees" },
  surin: { file: "Surin Beach.JPG", alt: "Surin Beach's clear water and a wooded headland" },
  "bang-pae": {
    file: "Near Bang Pae waterfall 2010 - panoramio (2).jpg",
    alt: "Rainforest plants beside a pool near Bang Pae Waterfall",
  },
  "hkt-airport": {
    file: "201701 International Terminal of HKT.jpg",
    alt: "Phuket airport's international terminal across the grass",
  },

  // Stays: every one is made up, so each photo is a stand-in.
  "h-riverside": {
    file: "King Nan's Teak House2.jpg",
    alt: "A traditional teak house in a garden",
    standIn: "A stand-in photo of a teak house like this one. The guesthouse is made up.",
  },
  "h-phranakhon": {
    file: "Good maintained beautiful courtyard of Katathani Beach Resort Phuket - panoramio.jpg",
    alt: "A green hotel courtyard with a pond and a balcony",
    standIn: "A stand-in photo of a courtyard like this one's. The hotel is made up.",
  },
  "h-silom": {
    file: "Hotel swimming pool in Sukhumvit.jpg",
    alt: "A rooftop pool with Bangkok's towers behind it",
    standIn: "A stand-in photo of a rooftop pool in Bangkok. The hotel is made up.",
  },
  "h-sukhumvit": {
    file: "Sukhumvit Soi 31 -01.jpg",
    alt: "A quiet, leafy side street off Sukhumvit",
    standIn:
      "A quiet soi off Sukhumvit, like the one this guesthouse is on. The guesthouse is made up.",
  },
  "h-ari": {
    file: "Room at Siamaze Hostel.jpg",
    alt: "A simple, bright room with a bed and a window",
    standIn: "A stand-in photo of a simple room. The apartments are made up.",
  },
  "h-kata": {
    file: "Bungalow in Pai, Thailand.JPG",
    alt: "A wooden bungalow among trees",
    standIn: "A stand-in photo of a bungalow like these. The bungalows are made up.",
  },
  "h-oldtown": {
    file: "Sino-Portugese Buildings in Phuket Town (II).jpg",
    alt: "Restored Sino-Portuguese shophouses in Phuket Town",
    standIn:
      "Phuket Town's shophouses, like the one this guesthouse is in. The guesthouse is made up.",
  },
  "h-patong": {
    file: "Hotel Holiday Inn Bangkok Siam 5.jpg",
    alt: "A plain hotel room with a large window",
    standIn: "A stand-in photo of a hotel room. The hotel is made up.",
  },
  "h-naiharn": {
    file: "Le Meridien Nirwana Bali Villa private pool (2926930162).jpg",
    alt: "A small private pool beside sun loungers",
    standIn: "A stand-in photo of a villa's plunge pool. The villas are made up.",
  },
  "h-karon": {
    file: "Centara Villas Phuket Hotel - panoramio.jpg",
    alt: "The sea seen through trees from a hillside",
    standIn: "A stand-in photo of the sea near Karon. The hotel is made up.",
  },

  // Food: every place is made up; each photo shows the dish it is known for.
  "f-khaomangai": {
    file: "Hainanese chicken rice.jpg",
    alt: "Poached chicken on rice with sauces and broth",
    standIn: "A stand-in photo of khao man gai, the stall's one dish. The stall is made up.",
  },
  "f-thatien": {
    file: "Kung yang.JPG",
    alt: "Grilled river prawns on a plate",
    standIn: "A stand-in photo of grilled river prawns. The restaurant is made up.",
  },
  "f-noodle": {
    file: "Noodle Soup in Chiang Rai.jpg",
    alt: "A bowl of pork noodle soup with herbs",
    standIn: "A stand-in photo of pork noodle soup. The stall is made up.",
  },
  "f-coffee": {
    file: "Cha Yen & Kaffer Yen - Thai Street Food, Worthing 2026-06-21.jpg",
    alt: "Two glasses of Thai iced tea and iced coffee",
    standIn: "A stand-in photo of Thai iced coffee and tea. The café is made up.",
  },
  "f-somtam": {
    file: "Som Tam green papaya salad, Bangkok, Thailand.jpg",
    alt: "A plate of green papaya salad with tomatoes",
    standIn: "A stand-in photo of som tam. The restaurant is made up.",
  },
  "f-coconut": {
    file: "Coconut Ice Cream, Bangkok.jpg",
    alt: "Coconut ice cream served in a coconut shell",
    standIn: "A stand-in photo of coconut ice cream. The stall is made up.",
  },
  "f-goldenmount": {
    file: "Boat Noodles with sliced beef round steak, beef ball, braised shank and tendon.jpg",
    alt: "A small bowl of dark boat noodle soup with beef",
    standIn: "A stand-in photo of boat noodles. The noodle house is made up.",
  },
  "f-phraathit": {
    file: "Roast Duck Curry - Thai Dish 2026-08-05.jpg",
    alt: "A bowl of red curry with roast duck",
    standIn: "A stand-in photo of a Thai curry. The restaurant is made up.",
  },
  "f-dimsum": {
    file: "DFC 4109 Colorful steamed dim sum skewers - green and yellow siu mai and more fresh from the bamboo steamer.jpg",
    alt: "Green and yellow steamed dim sum in a tray",
    standIn: "A stand-in photo of dim sum. The café is made up.",
  },
  "f-rang": {
    file: "Mandarin Oriental Dhara Dhevi Chiang Mai 11.jpg",
    alt: "A table on a terrace above trees at dusk",
    standIn: "A stand-in photo of a terrace table. The restaurant is made up.",
  },
  "f-chalong": {
    file: "DFC 6167 Crispy whole grilled fish cooling on a wire rack ready to be served at a seaside market in Sattahip.jpg",
    alt: "Whole grilled fish on a wire rack",
    standIn: "A stand-in photo of grilled fish. The restaurant is made up.",
  },
  "f-fruit": {
    file: "DSCF0275 A colorful pile of ripe and unripe mangoes displayed for sale at a market stall with handwritten yellow price signs in the background.jpg",
    alt: "A pile of ripe mangoes on a market stall",
    standIn: "A stand-in photo of mangoes at a fruit stall. The stand is made up.",
  },
  "f-katagrill": {
    file: "DZ3 0648 Grilled chicken wings and skewered seafood sizzle over coals at a busy Thai street food stall.jpg",
    alt: "Skewered prawns grilling over coals",
    standIn: "A stand-in photo of seafood on a grill. The restaurant is made up.",
  },
  "f-karonshack": {
    file: "Phat Thai kung Chang Khien street stall.jpg",
    alt: "A plate of pad thai with prawns, lime and bean sprouts",
    standIn: "A stand-in photo of pad thai. The beach bar is made up.",
  },
  "f-bangpae": {
    file: "Thai noodle soup, Khao Yai, Thailand.jpg",
    alt: "A bowl of noodle soup with meatballs",
    standIn: "A stand-in photo of noodle soup. The café is made up.",
  },
  "f-surin": {
    file: "Sunset with yacht, Phuket island, Thailand (26836198739).jpg",
    alt: "A yacht against an orange sunset over the sea",
    standIn: "A stand-in photo of a Phuket sunset. The restaurant is made up.",
  },
  "f-patong": {
    file: "DFC 5507 A street vendor carefully pours hot noodles into a takeaway cup at a bustling night market in Sattahip Thailand.jpg",
    alt: "A street vendor serving noodles at night",
    standIn: "A stand-in photo of a night noodle stall. The stall is made up.",
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, as = "json") {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) {
      await sleep(4000 * (i + 1));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} for ${url}`);
    return as === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
  }
  throw new Error(`Gave up on ${url}`);
}
const strip = (s = "") =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Commons' metadata for up to 40 files at once, with a URL for a copy 1600 pixels wide. */
async function info(files) {
  const titles = files.map((f) => `File:${f}`).join("|");
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(titles)}`;
  const r = await get(url);
  const norm = new Map((r.query.normalized ?? []).map((n) => [n.to, n.from]));
  const out = new Map();
  for (const p of Object.values(r.query.pages)) {
    if (!p.imageinfo) throw new Error(`Not on Commons: ${p.title}`);
    out.set((norm.get(p.title) ?? p.title).replace(/^File:/, ""), p.imageinfo[0]);
  }
  return out;
}

/** The photographer's name: some Commons pages put a paragraph of terms in the author field ("This photo was taken
 *  by A. Name. Please credit…"). A source's own `credit` wins over this. */
function author(text) {
  const by = /taken by ([^.(]+?)[.(]/i.exec(text)?.[1]?.trim();
  // A Commons account reads as its name ("User:Diliff" is Diliff).
  const name = (by ?? text).replace(/^User:/, "");
  if (!name) return "Unknown author";
  if (name.length > 60)
    throw new Error(
      `Give this photo a credit in SOURCES; its author field is long: ${name.slice(0, 80)}…`,
    );
  return name;
}

const vips = (...args) =>
  execFileSync("vips", args, { stdio: ["ignore", "pipe", "pipe"] }).toString();

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "trips-photos-"));
const entries = Object.entries(SOURCES);
const meta = new Map();
for (let i = 0; i < entries.length; i += 40) {
  const batch = await info(entries.slice(i, i + 40).map(([, s]) => s.file));
  for (const [k, v] of batch) meta.set(k, v);
  await sleep(1000);
}

const rows = [];
for (const [id, s] of entries) {
  const ii = meta.get(s.file.replace(/_/g, " ")) ?? meta.get(s.file);
  if (!ii) throw new Error(`No metadata for ${s.file}`);
  const m = ii.extmetadata ?? {};
  const license = strip(m.LicenseShortName?.value);
  if (!ALLOWED.test(license))
    throw new Error(`${id}: ${s.file} is ${license}, which this app does not use`);
  const large = join(OUT, `${id}.webp`);
  const small = join(OUT, `${id}-s.webp`);
  if (force || !existsSync(large) || !existsSync(small)) {
    const raw = join(tmp, `${id}.jpg`);
    writeFileSync(raw, await get(ii.thumburl ?? ii.url, "buffer"));
    for (const [file, width, q] of [
      [large, 1200, 64],
      [small, 440, 66],
    ]) {
      const png = join(tmp, `${id}-${width}.png`);
      // Never wider than the source; the colours as the camera meant them (sRGB), no metadata kept.
      vips("thumbnail", raw, png, String(width), "--size", "down");
      execFileSync("cwebp", [
        "-quiet",
        "-q",
        String(q),
        "-m",
        "6",
        "-metadata",
        "none",
        png,
        "-o",
        file,
      ]);
    }
    await sleep(300);
  }
  // Size and tone from the small copy: its average colour, shown while the photo loads.
  const [w, h] = execFileSync("magick", ["identify", "-format", "%w %h", large])
    .toString()
    .split(" ")
    .map(Number);
  const avg = join(tmp, `${id}-1.png`);
  vips("thumbnail", small, avg, "1", "--height", "1", "--size", "force");
  const [r, g, b] = execFileSync("magick", [
    avg,
    "-format",
    "%[fx:int(255*r)],%[fx:int(255*g)],%[fx:int(255*b)]",
    "info:",
  ])
    .toString()
    .split(",")
    .map(Number);
  const tone = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  rows.push({
    id,
    file: id,
    w,
    h,
    tone,
    alt: s.alt,
    ...(s.focus ? { focus: s.focus } : {}),
    ...(s.standIn ? { standIn: s.standIn } : {}),
    credit: s.credit ?? author(strip(m.Artist?.value)),
    license,
    ...(m.LicenseUrl?.value ? { licenseUrl: m.LicenseUrl.value } : {}),
    source: ii.descriptionurl,
  });
  process.stdout.write(".");
}
rmSync(tmp, { recursive: true, force: true });

writeFileSync(
  DATA,
  `/**
 * The trip's photos, from Wikimedia Commons: written by scripts/photos.mjs, which says how they were chosen. Edit the
 * script's SOURCES and run it again rather than editing this file.
 */

export interface PhotoInfo {
  /** public/photos/<file>.webp (1200 wide) and <file>-s.webp (440 wide). */
  file: string;
  w: number;
  h: number;
  /** The photo's average colour, shown while it loads. */
  tone: string;
  alt: string;
  /** Where to crop from (CSS object-position), when the subject is off centre. */
  focus?: string;
  /** For a made-up business: what the photo shows instead. */
  standIn?: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  /** The photo's page on Commons. */
  source: string;
}

export const PHOTOS: Record<string, PhotoInfo> = ${JSON.stringify(Object.fromEntries(rows.map(({ id, ...p }) => [id, p])), null, 2)};

export const photoOf = (id: string): PhotoInfo | undefined => PHOTOS[id];
`,
);
console.log(`\n${rows.length} photos in public/photos, credits in src/trip/photos.ts`);
