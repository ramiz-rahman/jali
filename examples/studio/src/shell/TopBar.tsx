/**
 * The app's top bar, inside <JaliRoot>: the layouts (Jali's presets), the transport, and the link, theme and ⌘K.
 * Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout change.
 *
 * The transport is the app's, not a pane's: it is always on screen, and it drives the one playhead every pane follows.
 */
import {
  ArrowArcLeftIcon,
  ArrowArcRightIcon,
  CommandIcon,
  LinkSimpleIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SunIcon,
  XIcon,
} from "@phosphor-icons/react";
import { copyLink, keyHint } from "@jali/core";
import { useJali, useJaliState, useShortcut, useTheme } from "@jali/react";
import { SPEEDS } from "../audio/engine";
import { usePosition, useTransport } from "../audio/react";
import { useServices } from "../services";
import { clock, clockTenths, sessionById } from "../sessions/sessions";

/** Toolbar buttons don't keep focus after a click, so Space goes on playing and pausing. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useTheme();
  const palette = useShortcut("palette.toggle");

  return (
    <header className="topbar" data-jali-chrome="">
      <a className="brand" href="./" aria-label="Studio, a Jali example: back to the Edit layout">
        <StudioMark />
        <span className="brand-name">Studio</span>
      </a>
      <nav className="layouts" aria-label="Layouts">
        {jali.env.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            onMouseDown={keepFocus}
            onClick={() => jali.actions.preset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <label className="layouts-select">
        <span className="sr-only">Layout</span>
        <select value={current} onChange={(e) => jali.actions.preset(e.target.value)}>
          {jali.env.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <Transport />
      <div className="topbar-end">
        <button
          type="button"
          className="icon-btn"
          aria-label="Copy a link to this layout"
          title="Copy a link to this layout"
          onMouseDown={keepFocus}
          onClick={() => copyLink(jali)}
        >
          <LinkSimpleIcon size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={theme === "dark" ? "Use the light theme" : "Use the dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          onMouseDown={keepFocus}
          onClick={() =>
            jali.actions.changeSettings({ theme: theme === "dark" ? "light" : "dark" })
          }
        >
          {theme === "dark" ? <SunIcon size={16} aria-hidden /> : <MoonIcon size={16} aria-hidden />}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-wide"
          aria-label="Commands"
          title={`Commands ${palette}`}
          onMouseDown={keepFocus}
          onClick={() => jali.actions.openPalette()}
        >
          <CommandIcon size={15} aria-hidden />
          <kbd>{palette || keyHint("Mod+K")}</kbd>
        </button>
      </div>
    </header>
  );
}

function Transport() {
  const { engine } = useServices();
  const t = useTransport((s) => s);
  const session = sessionById(t.session)!;
  const pos = usePosition(false, 0.1);
  const ready = t.status === "ready";
  return (
    <div className="transport" role="group" aria-label="Transport">
      <div className="tp-session">
        <span className="tp-show">
          {session.show} · Ep {session.episode}
        </span>
        <span className="tp-title">{session.title}</span>
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Back 5 seconds"
        title="Back 5 seconds"
        onMouseDown={keepFocus}
        onClick={() => engine.skip(-5)}
      >
        <ArrowArcLeftIcon size={17} aria-hidden />
      </button>
      <button
        type="button"
        className="play-btn"
        aria-label={t.playing ? "Pause" : "Play"}
        title={`${t.playing ? "Pause" : "Play"} (Space)`}
        disabled={!ready}
        onMouseDown={keepFocus}
        onClick={() => engine.toggle()}
      >
        {t.playing ? (
          <PauseIcon size={17} weight="fill" aria-hidden />
        ) : (
          <PlayIcon size={17} weight="fill" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Forward 5 seconds"
        title="Forward 5 seconds"
        onMouseDown={keepFocus}
        onClick={() => engine.skip(5)}
      >
        <ArrowArcRightIcon size={17} aria-hidden />
      </button>
      <span className="tp-time mono" aria-label={`${clock(pos)} of ${clock(session.duration)}`}>
        <span className="tp-now">{clockTenths(pos)}</span>
        <span className="tp-total">/ {clock(session.duration)}</span>
      </span>
      <label className="tp-speed">
        <span className="sr-only">Speed</span>
        <select value={t.rate} onChange={(e) => engine.setRate(Number(e.target.value))}>
          {SPEEDS.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </label>
      {t.loop ? (
        <span className="tp-loop">
          <RepeatIcon size={13} aria-hidden />
          <span className="mono">
            {clock(t.loop.start)}–{clock(t.loop.end)}
          </span>
          <button
            type="button"
            className="tp-loop-off"
            aria-label="Stop looping"
            onMouseDown={keepFocus}
            onClick={() => engine.setLoop(null)}
          >
            <XIcon size={11} aria-hidden />
          </button>
        </span>
      ) : null}
      <span className="tp-status" role="status">
        {t.status === "loading" ? "Loading audio…" : t.status === "error" ? "The audio didn't load" : ""}
      </span>
    </div>
  );
}

/** Studio's mark: four bars of a waveform, the loudest in signal orange. */
function StudioMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="brand-mark">
      <rect x="2" y="9" width="3" height="6" rx="1.5" />
      <rect x="7.5" y="5" width="3" height="14" rx="1.5" />
      <rect x="13" y="2" width="3" height="20" rx="1.5" className="brand-mark-hot" />
      <rect x="18.5" y="7" width="3" height="10" rx="1.5" />
    </svg>
  );
}
