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
import { copyLink, keyHint, runCommand } from "jali";
import { useJali, useJaliState, useJaliShortcut, useJaliTheme } from "jali/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/atoms/select";
import { toggleTheme } from "../workspace/theme";
import "./top-bar.css";

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useJaliTheme();
  const palette = useJaliShortcut("palette.toggle") || keyHint("Mod+K");

  return (
    <header className="topbar" data-jali-chrome="">
      <a className="brand" href="./" aria-label="Trips, a Jali example: back to the plan">
        <TripsMark />
        {/* What it is ("a Jali example") is said once on screen, by the status line; the name says it to a reader. */}
        <span className="brand-name">Trips</span>
      </a>
      <nav className="presets" aria-label="Layouts">
        {jali.presets.map((p) => (
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
      <div className="presets-select">
        <Select value={current ?? ""} onValueChange={(id) => jali.actions.preset(id)}>
          <SelectTrigger aria-label="Layout">
            <SelectValue placeholder="Layout" />
          </SelectTrigger>
          <SelectContent>
            {jali.presets.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
          onClick={() => toggleTheme(jali)}
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
          aria-label={`Commands ${palette}`}
          title="Commands"
          onClick={() => jali.dialogs.openPalette()}
        >
          <CommandIcon size={18} className="commands-icon" aria-hidden />
          <kbd>{palette}</kbd>
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
