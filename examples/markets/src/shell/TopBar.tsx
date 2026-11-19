/**
 * The app's top bar, inside <JaliRoot>: the desks (Jali's presets), a few index levels, search, the market clock,
 * the theme and ⌘K. Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout change.
 */
import { CommandIcon, MagnifyingGlassIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import { useJali, useJaliState, useShortcut, useTheme } from "@jali/react";
import { useQuotes, useTopic } from "../market/react";
import { useServices } from "../services";
import * as f from "../ui/format";
import { Delta } from "../ui/parts";
import { show } from "../actions";
import { chart } from "../panes/chart";

// In order of priority: narrower windows show the first few.
const STRIP = ["MX40", "MXTEC", "GOV10Y", "EURUSD", "MXFIN", "GOV2Y"];

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useTheme();
  const palette = useShortcut("palette.toggle");
  const { picker } = useServices();
  const search = () =>
    picker.set({ title: "Open chart for…", onPick: (symbol) => show(jali, chart({ symbol })) });

  return (
    <header className="topbar" data-jali-chrome="">
      <a className="brand" href="./" aria-label="Markets, a Jali example: back to the default desk">
        <JaliMark />
        <span>Markets</span>
      </a>
      <nav className="desks" aria-label="Desks">
        {jali.env.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            onClick={() => jali.actions.preset(p.id)}
          >
            {p.label.replace(" desk", "")}
          </button>
        ))}
      </nav>
      <label className="desks-select">
        <span className="sr-only">Desk</span>
        <select value={current} onChange={(e) => jali.actions.preset(e.target.value)}>
          {jali.env.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <Strip />
      <div className="topbar-end">
        <button type="button" className="search" onClick={search} aria-label="Search instruments">
          <MagnifyingGlassIcon size={14} aria-hidden />
          <span className="search-text">Search</span>
          <kbd>/</kbd>
        </button>
        <Clock />
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
            <SunIcon size={16} aria-hidden />
          ) : (
            <MoonIcon size={16} aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-wide"
          aria-label="Commands"
          title={`Commands ${palette}`}
          onClick={() => jali.actions.openPalette()}
        >
          <CommandIcon size={16} aria-hidden />
          <kbd>{palette || keyHint("Mod+K")}</kbd>
        </button>
      </div>
    </header>
  );
}

/** A few levels across the top, at widths with room for them. */
function Strip() {
  const { market } = useServices();
  const quotes = useQuotes(STRIP);
  return (
    <ul className="strip" aria-label="Market levels">
      {STRIP.map((s) => {
        const q = quotes.get(s);
        const inst = market.instrument(s);
        if (!q || !inst) return null;
        const bond = q.yield !== undefined;
        return (
          <li key={s}>
            <span className="strip-sym">{s}</span>
            <span className="strip-last">{bond ? f.percent(q.yield!) : f.price(inst, q.last)}</span>
            <Delta value={bond ? q.yieldChangeBp! : q.change}>
              {bond ? f.bp(q.yieldChangeBp!) : f.pct(q.changePct)}
            </Delta>
          </li>
        );
      })}
    </ul>
  );
}

function Clock() {
  const now = useTopic({ channel: "clock" });
  return (
    <span className="clock" title="Market time. Every price here is simulated.">
      <span className="live-dot" aria-hidden />
      <span className="clock-label">Simulated</span>
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
