/**
 * What this is and who made it, the same in every example: "Example app built with Jali" beside Jali's lockup, and
 * the maker's mark and name. One place for the words, the marks and the links: each app's status line starts with
 * `<BuiltWithJali />` and ends with `<Maker />`, and `makerCommand` is in ⌘K.
 *
 * The styles here only lay the mark out. It takes its colour and its type from where it stands (`currentColor`,
 * `font: inherit`), so each app's own theme dresses it.
 */
import type { Command } from "@jali/core";
import { JaliLockup } from "../shell/JaliLockup";
import "./maker.css";

export const MAKER = {
  name: "Ramiz Rahman",
  url: "https://ramizrahman.com/",
  credit: "Designed and built by Ramiz Rahman",
} as const;

export const JALI = {
  url: "https://jali.ramizrahman.com/",
  line: "Example app built with",
} as const;

/** The monogram (docs/brand/ramiz_rahman_personal_brand/Logo), in currentColor. */
export function MakerMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="maker-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.5 39.125v-6C13.59 33.09 8 27.48 8 20.563 8 13.645 13.59 8.034 20.5 8V2C10.277 2.034 2 10.331 2 20.562c0 10.231 8.277 18.529 18.5 18.563Z" />
      <rect x="15.175" y="36" width="6" height="26.274" transform="rotate(30 15.175 36)" />
      <path d="M43.5 39.125v-6c6.91-.034 12.5-5.645 12.5-12.563C56 13.645 50.41 8.034 43.5 8V2C53.723 2.034 62 10.331 62 20.562c0 10.231-8.277 18.529-18.5 18.563Z" />
      <rect width="6" height="26.274" transform="matrix(-.866 .5 .5 .866 48.825 36)" />
      <path d="M24 6.5h6v51h-6zM34 6.5h6v51h-6z" />
    </svg>
  );
}

/**
 * The mark and the name, linking to the maker's site. For a status line or a footer. With `words`, "Designed and
 * built by" is printed before them, to mirror "Example app built with Jali" at the other end of a line.
 */
export function Maker({ words = false }: { words?: boolean }) {
  return (
    <a
      className="maker"
      href={MAKER.url}
      target="_blank"
      rel="noopener"
      title={MAKER.credit}
      aria-label={words ? MAKER.credit : MAKER.name}
    >
      {words ? <span className="maker-words">Designed and built by</span> : null}
      <MakerMark />
      <span className="maker-name">{MAKER.name}</span>
    </a>
  );
}

/** "Example app built with Jali": the words and Jali's lockup, linking to Jali's site. */
export function BuiltWithJali() {
  return (
    <a
      className="built-with"
      href={JALI.url}
      target="_blank"
      rel="noopener"
      aria-label={`${JALI.line} Jali`}
    >
      <span className="maker-words">{JALI.line}</span>
      <JaliLockup />
    </a>
  );
}

/** ⌘K "About": who made it, and a way to the site. */
export const makerCommand: Command = {
  id: "app.about",
  title: "About: an example app built with Jali, by Ramiz Rahman",
  group: "Help",
  run: () => void window.open(MAKER.url, "_blank", "noopener"),
};
