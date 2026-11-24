/**
 * Jali's lockup and mark, drawn inline so they take the theme's colours. Geometry from docs/brand/build_final.py
 * (jali-lockup-small.svg, jali-mark.svg in docs/brand/final/jali); the files themselves are in public/.
 *
 * The mark is an arched window: a frame holding three panes (one tall, two stacked) filled with a finer lattice.
 * Each is one even-odd path: the arch, the panes cut from it, the bars filled back in.
 */

/** The small mark (16–48px): a heavier frame, one bar in the tall pane, one flat bar below the transom. */
const MARK_SMALL =
  "M14 92.3V40A36 36 0 0 1 86 40V92.3ZM24 82.3V40A26 26 0 0 1 50.5 14V82.3ZM33.25 82.3V20.11A26 26 0 0 1 41.25 15.52V82.3ZM60.5 43V16.21A26 26 0 0 1 76 40V43ZM60.5 53H76V82.3H60.5ZM60.5 64.15H76V71.15H60.5Z";

/** The full mark (48px and up): three bars in the tall pane, two above the transom, two flat below it. */
const MARK =
  "M14 92.3V40A36 36 0 0 1 86 40V92.3ZM22 84.3V40A28 28 0 0 1 51.5 12.04V84.3ZM26.75 84.3V24.4A28 28 0 0 1 30.25 20.15V84.3ZM35 84.3V16.36A28 28 0 0 1 38.5 14.47V84.3ZM43.25 84.3V12.83A28 28 0 0 1 46.75 12.19V84.3ZM59.5 44V13.66A28 28 0 0 1 78 40V44ZM63.33 44V15.38A28 28 0 0 1 66.83 17.63V44ZM70.67 44V21.11A28 28 0 0 1 74.17 25.86V44ZM59.5 52H78V84.3H59.5ZM59.5 60.43H78V63.93H59.5ZM59.5 72.37H78V75.87H59.5Z";

/** "jali", outlined: Atkinson Hyperlegible Next SemiBold, standing on the arch's sill, its dots level with the crown. */
const WORDMARK =
  "M97.87 108.17V98.37H104.32Q108.26 98.37 110.36 97.84Q112.45 97.3 113.22 95.78Q114 94.26 114 91.34V33.04H128.58V92.99Q128.58 98.86 126.13 102.2Q123.68 105.53 118.78 106.85Q113.88 108.17 106.59 108.17ZM121.41 22.64Q117.58 22.64 114.84 19.89Q112.09 17.14 112.09 13.32Q112.09 9.38 114.84 6.69Q117.58 4 121.29 4Q125.23 4 127.92 6.69Q130.61 9.38 130.61 13.32Q130.61 17.14 127.92 19.89Q125.23 22.64 121.41 22.64Z M156.9 93.73Q151.28 93.73 146.62 91.64Q141.96 89.55 139.15 85.73Q136.34 81.9 136.34 76.53Q136.34 69.48 141.3 65.18Q146.26 60.88 155.34 58.55Q164.42 56.22 176.73 55.14V53.59Q176.73 48.09 173.74 45.1Q170.76 42.12 164.78 42.12Q160.36 42.12 157.25 44.15Q154.15 46.18 153.19 50.12L140.29 45.7Q143.04 39.37 149.55 35.54Q156.06 31.72 165.14 31.72Q177.81 31.72 184.2 37.46Q190.59 43.19 190.59 56.1V69.48Q190.59 73.78 190.89 78.02Q191.19 82.26 191.67 85.91Q192.14 89.55 192.74 92.3H179.24L176.97 84.77Q173.98 89.31 168.96 91.52Q163.95 93.73 156.9 93.73ZM161.79 83.22Q165.98 83.22 169.32 81.84Q172.67 80.47 174.7 77.13Q176.73 73.78 176.73 67.92V64.7Q164.9 65.65 158.39 68.1Q151.88 70.55 151.88 75.69Q151.88 79.04 154.57 81.13Q157.25 83.22 161.79 83.22Z M219.39 92.3Q212.93 92.3 209.11 91.05Q205.29 89.79 203.73 86.45Q202.18 83.1 202.18 76.77V7.7H216.76V73.54Q216.76 77.48 218.19 78.8Q219.63 80.11 224.17 80.11H228.83V92.3Z M240.06 92.3V44.27H230.86V33.04H254.75V92.3ZM246.51 22.64Q242.69 22.64 239.94 19.89Q237.19 17.14 237.19 13.32Q237.19 9.38 239.94 6.69Q242.69 4 246.39 4Q250.33 4 253.02 6.69Q255.71 9.38 255.71 13.32Q255.71 17.14 253.02 19.89Q250.33 22.64 246.51 22.64Z";

/**
 * The lockup: the mark in Nil, the word in ink. The small mark by default (nav bars, 16–48px), with the small
 * lockup's looser gap; `full` for the full mark and the tighter gap where the lockup is large (the footer). The box is
 * the mark's, so CSS sizes the arch; the j's descender hangs below it.
 */
export function Lockup({ className, full }: { className?: string; full?: boolean }) {
  return (
    <svg
      className={className}
      viewBox={full ? "12 2 247 96" : "12 2 252.3 96"}
      overflow="visible"
      role="img"
      aria-label="Jali"
    >
      <path className="lockup-mark" fillRule="evenodd" d={full ? MARK : MARK_SMALL} />
      <path
        className="lockup-word"
        d={WORDMARK}
        transform={full ? "translate(-5.3 0)" : undefined}
      />
    </svg>
  );
}
