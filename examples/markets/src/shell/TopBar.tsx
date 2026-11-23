/**
 * The app's top bar, inside <JaliRoot>: the desks (Jali's presets) and Reset, a few index levels, search, the clock,
 * the theme and ⌘K. Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout change.
 */
import {
  ArrowCounterClockwiseIcon,
  CommandIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { keyHint, runCommand } from "jali";
import { IconButton, useJali, useJaliState, useJaliShortcut, useJaliTheme } from "jali/react";
import { useTopic } from "../market/react";
import { useServices } from "../services";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/atoms/select";
import * as f from "../ui/format";
import { deskTab } from "../workspace/presets";
import { Strip } from "./Strip";

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useJaliTheme();
  const palette = useJaliShortcut("palette.toggle");
  const { savedLayouts } = useServices();
  const search = () => runCommand(jali, "markets.chart");
  // Every desk back to the demo's layout, once the app has asked about a typed order (workspace/savedLayouts.ts).
  const reset = () => savedLayouts.resetAll(jali);

  return (
    <header className="topbar" data-jali-chrome="">
      <a className="brand" href="./" aria-label="Markets, a Jali example: back to the default desk">
        <JaliMark />
        <span>Markets</span>
      </a>
      <nav className="desks" aria-label="Desks">
        {jali.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            onClick={() => jali.actions.preset(p.id)}
          >
            {deskTab(p.id)}
          </button>
        ))}
      </nav>
      <div className="desks-select">
        <Select value={current ?? ""} onValueChange={(id) => jali.actions.preset(id)}>
          <SelectTrigger aria-label="Desk">
            <SelectValue placeholder="Desk" />
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
      <IconButton label="Reset every desk to the demo layout" onClick={reset}>
        <ArrowCounterClockwiseIcon size={15} aria-hidden />
      </IconButton>
      <Strip />
      <div className="topbar-end">
        <button type="button" className="search" onClick={search} aria-label="Search instruments">
          <MagnifyingGlassIcon size={14} aria-hidden />
          <span className="search-text">Search</span>
          <kbd>/</kbd>
        </button>
        <Clock />
        <IconButton
          label={theme === "dark" ? "Use the light theme" : "Use the dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          onClick={() =>
            jali.actions.changeSettings({ theme: theme === "dark" ? "light" : "dark" })
          }
        >
          {theme === "dark" ? (
            <SunIcon size={16} aria-hidden />
          ) : (
            <MoonIcon size={16} aria-hidden />
          )}
        </IconButton>
        <button
          type="button"
          className="palette-btn"
          // The name says the key it shows (WCAG 2.5.3: what is seen is part of what is said).
          aria-label={`Commands ${palette || keyHint("Mod+K")}`}
          title={`Commands ${palette}`}
          onClick={() => jali.dialogs.openPalette()}
        >
          <CommandIcon size={16} aria-hidden />
          <kbd>{palette || keyHint("Mod+K")}</kbd>
        </button>
      </div>
    </header>
  );
}

/** The simulated market's clock: the session the shares, bonds and currencies trade in. Crypto never closes. */
function Clock() {
  const now = useTopic({ channel: "clock" });
  return (
    <span
      className="clock"
      title="Market time. Crypto prices are live from Kraken; everything else is simulated."
    >
      <time>{f.time(now)}</time>
    </span>
  );
}

/** Jali's mark, small: an arch of bars. */
function JaliMark() {
  return (
    <svg viewBox="12 2 76 96" width="14" height="18" aria-hidden className="brand-mark">
      <defs>
        <clipPath id="markets-mark">
          <path d="M14 92.3V40A36 36 0 0 1 86 40V92.3Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#markets-mark)" fill="currentColor">
        <rect x="13.7" y="0" width="9" height="92.3" />
        <rect x="27.3" y="0" width="9" height="92.3" />
        <rect x="40.9" y="0" width="9" height="92.3" />
        <rect x="63.7" y="0" width="9" height="42.3" />
        <rect x="77.3" y="0" width="9" height="42.3" />
        <rect x="63.7" y="56.1" width="100" height="9" />
        <rect x="63.7" y="69.7" width="100" height="9" />
        <rect x="63.7" y="83.3" width="100" height="9" />
      </g>
    </svg>
  );
}
