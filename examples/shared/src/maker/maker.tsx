/**
 * Who made this: Jali and every example app are designed and built by Ramiz Rahman. One place for the name, the
 * mark and the link, so each app shows the same thing: `<Maker />` in its status line and `makerCommand` in ⌘K.
 *
 * The styles here only lay the mark out. It takes its colour and its type from where it stands (`currentColor`,
 * `font: inherit`), so each app's own theme dresses it.
 */
import type { Command } from "@jali/core";
import "./maker.css";

export const MAKER = {
  name: "Ramiz Rahman",
  url: "https://ramizrahman.com/",
  credit: "Designed and built by Ramiz Rahman",
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

/** The mark and the name, linking to the maker's site. For a status line or a footer. */
export function Maker() {
  return (
    <a
      className="maker"
      href={MAKER.url}
      target="_blank"
      rel="noopener"
      title={MAKER.credit}
      aria-label={MAKER.name}
    >
      <MakerMark />
      <span>{MAKER.name}</span>
    </a>
  );
}

/** ⌘K "About": who made it, and a way to the site. */
export const makerCommand: Command = {
  id: "app.about",
  title: "About: designed and built by Ramiz Rahman",
  group: "Help",
  run: () => void window.open(MAKER.url, "_blank", "noopener"),
};
