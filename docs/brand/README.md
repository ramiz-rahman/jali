# Chakni and Jali: logos

Two sibling libraries, one bar system. `final/preview.png` shows every piece in light and dark; `final/preview-small.png` the small marks and app icons. (Both predate Jali's window mark of November 2026; re-render them before relying on them.)

- **Chakni** (ছাঁকনি, the tea strainer): a round disc of bars cut flat across; below the cut, finer bars taper into one stream that lets go of a single drop. Pour in everything, keep what you came for. The outline stays round: an earlier V-shaped lower edge read as a swimsuit.
- **Jali** (জালি, the lattice screen): an arched window. Its frame (the arch, the sill, a mullion and, on the right, a transom) holds three panes: one tall, two stacked, the layout Jali makes. A finer lattice fills them: upright bars above the transom, flat bars below it. The frame is about the wordmark's stem weight, the lattice under half of it. The small mark keeps the frame, heavier, with one upright bar in the tall pane and one flat bar below the transom. The mark is one even-odd path: the arch, the panes cut from it, the bars filled back in.

## The system

- Bars 5.54 wide on an 8.03 pitch, a 72-unit-wide silhouette; both marks share one 76 × 96 box, so they size alike.
- Small versions (`*-mark-small`) for 16–48px: fewer, heavier bars on the same plan. The small Chakni is the disc and one drop, with no stream: at icon sizes a thick bar over a dot reads as "!".
- Wordmark: Atkinson Hyperlegible Next SemiBold (OFL), outlined, tracked −2.5%; the j's descender is shortened to 82% so "jali" sits level. SemiBold, not Bold: the bars carry the weight, the type carries the voice.
- Jali's lockup: the word stands on the arch's sill and the dots of its j and i sit level with the arch's crown, so mark and word share a top and a baseline; the mark is about 88% of the word's height (the word is 119.5 units against an arch 88 tall, 22.7 units from the arch to the j's stem, 28 in the small lockup, which needs more air at nav sizes). The j's descender hangs below the sill, its hook under the arch's corner. Inline on a page, the lockup's box is the mark's and the descender overflows it, so a height in CSS sizes the arch and the arch centres on the text beside it.
- Colour: the marks ship in ink `#111111` or white; each library also has a signature colour, used on its own ground. The two are near-complementary, and both are Bengali stories: tea and indigo.

## Signature colours

|                            | Chakni: Cha (brewed tea) | Jali: Nil (Bengal indigo) |
| -------------------------- | ------------------------ | ------------------------- |
| Mark, fills                | `#C2621A`                | `#2B3990`                 |
| Text and controls on white | `#9C4A12` (6.2:1)        | `#4456C7` (6.2:1)         |
| On dark                    | `#E89A4E`                | `#8C9BEA`                 |
| Ground                     | milk `#F6EBDD`           | stone `#EFEAE2`           |

- Keep Nil deep, never bright: it is ink-dyed cloth, not a tech purple.
- Cha is fainter at 16px than Nil; Chakni's favicon uses the deeper `#9C4A12`.
- Data Studio and Loan review use Nil as their accent (`--brand`, `--accent` in `examples/shared/src/shell/styles/tokens.css`) and Jali's favicon in Nil.

## Files (per library, in `final/<name>/`)

| File                                                                | Use                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `<name>-mark.svg`, `-white.svg`                                     | The mark, 48px and up                                       |
| `<name>-mark-small.svg`, `-white.svg`                               | The mark, 16–48px                                           |
| `<name>-lockup.svg`, `-white.svg`                                   | Mark and wordmark side by side: README headers, 48px and up |
| `<name>-lockup-small.svg`, `-white.svg`                             | The small mark and wordmark: nav bars, 16–32px              |
| `<name>-stacked.svg`, `-white.svg`                                  | Mark above wordmark: docs home, posters                     |
| `favicon.svg`                                                       | Browser tab; follows the system's light or dark mode        |
| `favicon-32.png`, `favicon-32-dark.png`                             | Fallback favicons                                           |
| `apple-touch-icon.png` (180), `icon-512.png`, `<name>-app-icon.svg` | Home-screen and PWA icons                                   |
| `<name>-social.svg`, `.png` (1280 × 640)                            | GitHub social preview, link cards                           |

## Rebuilding

`build_final.py <out_dir> <atkinson-hyperlegible-next-latin-600-normal.woff>` regenerates every SVG (needs `fonttools`; the font is in `@fontsource/atkinson-hyperlegible-next`). PNGs are rendered from the SVGs in Chrome.

`archive/` holds the earlier rounds and concepts (not committed: about 50MB of images).
