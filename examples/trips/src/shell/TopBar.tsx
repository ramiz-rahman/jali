/**
 * The top bar, inside <JaliRoot>: the four layouts (Jali's presets), the trip, search, copy link, the theme and ⌘K.
 * Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout change.
 */
import {
  CommandIcon,
  LinkSimpleIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { copyLink, keyHint, runCommand } from "@jali/core";
import { useJali, useJaliState, useShortcut, useTheme } from "@jali/react";

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useTheme();
  const palette = useShortcut("palette.toggle");

  return (
    <header className="topbar" data-jali-chrome="">
      <a className="brand" href="./" aria-label="Trips, a Jali example: back to the plan">
        <TripsMark />
        {/* The space between keeps the two words apart in the text a screen reader matches the name against. */}
        <span className="brand-name">Trips</span> <span className="brand-sub">a Jali example</span>
      </a>
      <nav className="presets" aria-label="Layouts">
        {jali.env.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            onClick={() => jali.actions.preset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <label className="presets-select">
        <span className="sr-only">Layout</span>
        <select value={current} onChange={(e) => jali.actions.preset(e.target.value)}>
          {jali.env.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="topbar-end">
        <button
          type="button"
          className="search"
          onClick={() => runCommand(jali, "trips.go")}
          aria-label="Find a place"
        >
          <MagnifyingGlassIcon size={16} aria-hidden />
          <span className="search-text">Find a place</span>
          <kbd>/</kbd>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Copy a link to this layout"
          title="Copy link: it opens this layout, day and place"
          onClick={() => copyLink(jali)}
        >
          <LinkSimpleIcon size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={theme === "dark" ? "Use the light theme" : "Use the dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          onClick={() =>
            jali.actions.changeSettings({ theme: theme === "dark" ? "light" : "dark" })
          }
        >
          {theme === "dark" ? (
            <SunIcon size={18} aria-hidden />
          ) : (
            <MoonIcon size={18} aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="icon-btn commands-btn"
          // The name says the key it shows (WCAG 2.5.3: what is seen is part of what is said).
          aria-label={`Commands ${palette || keyHint("Mod+K")}`}
          title="Commands"
          onClick={() => jali.actions.openPalette()}
        >
          <CommandIcon size={18} className="commands-icon" aria-hidden />
          <kbd>{palette || keyHint("Mod+K")}</kbd>
        </button>
      </div>
    </header>
  );
}

/** The app's mark: a route of three stops, the last one coral. Not Nava's, and not Jali's. */
function TripsMark() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden className="brand-mark">
      <path
        d="M6 21c3-6 7-2 9-7s5-6 7-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="0.1 4.2"
      />
      <circle cx="6" cy="21" r="3" fill="currentColor" />
      <circle cx="15" cy="14" r="3" fill="currentColor" />
      <circle cx="22" cy="6" r="3.6" className="brand-mark-end" />
    </svg>
  );
}
