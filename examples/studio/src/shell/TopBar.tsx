/**
 * The app's top bar, inside <JaliRoot>: the layouts (Jali's presets) as a row of keys, the transport, and keys for
 * the link, the theme and ⌘K. Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout change.
 *
 * The transport is the app's, not a pane's: a device of its own on the desk, always in reach, driving the one
 * playhead every pane follows. A screen with the time, four big square keys, a loop latch, a jog wheel to scrub and
 * a speed knob.
 */
import { CommandIcon, LinkSimpleIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { copyLink, keyHint, runCommand } from "@jali/core";
import { useJali, useJaliState, useShortcut, useTheme } from "@jali/react";
import { SPEEDS } from "../audio/engine";
import { usePosition, useTransport } from "../audio/react";
import { useServices } from "../services";
import { clock, clockTenths, sessionById } from "../sessions/sessions";
import { Jog, Knob } from "../ui/Knob";

/** Keys don't keep focus after a click, so Space goes on playing and pausing. */
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
        <span className="brand-name">studio</span>
      </a>
      <nav className="layouts" aria-label="Layouts">
        {jali.env.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className="key key-s"
            aria-pressed={p.id === current}
            onMouseDown={keepFocus}
            onClick={() => jali.actions.preset(p.id)}
          >
            <span className="led" aria-hidden />
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
          className="key key-icon"
          aria-label="Copy a link to this layout"
          title="Copy a link to this layout"
          onMouseDown={keepFocus}
          onClick={() => copyLink(jali)}
        >
          <LinkSimpleIcon size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="key key-icon"
          aria-label={theme === "dark" ? "Use the light theme" : "Use the dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          onMouseDown={keepFocus}
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
          className="key key-icon key-wide"
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
  const jali = useJali();
  const t = useTransport((s) => s);
  const session = sessionById(t.session)!;
  const pos = usePosition(false, 0.05);
  const ready = t.status === "ready";
  const speed = SPEEDS.indexOf(t.rate as (typeof SPEEDS)[number]);
  return (
    <div className="transport device" role="group" aria-label="Transport">
      <div className="screen tp-screen">
        <div className="tp-line">
          <span className="tp-show">
            {session.show} · ep {session.episode}
          </span>
          <span className="tp-state" role="status">
            {t.status === "loading"
              ? "loading"
              : t.status === "error"
                ? "no audio"
                : t.playing
                  ? "▶ play"
                  : "■ stop"}
          </span>
        </div>
        <span className="tp-title">{session.title}</span>
        <span className="tp-time" aria-label={`${clock(pos)} of ${clock(session.duration)}`}>
          <span className="tp-now">{clockTenths(pos)}</span>
          <span className="tp-total">{clock(session.duration)}</span>
          <span className="tp-rate">{t.rate}×</span>
        </span>
      </div>
      <div className="tp-keys">
        <button
          type="button"
          className="key key-l"
          aria-label="Back 5 seconds"
          title="Back 5 seconds"
          onMouseDown={keepFocus}
          onClick={() => engine.skip(-5)}
        >
          <Glyph name="back" />
        </button>
        <button
          type="button"
          className="key key-l key-play"
          aria-label={t.playing ? "Pause" : "Play"}
          title={`${t.playing ? "Pause" : "Play"} (Space)`}
          disabled={!ready}
          data-on={t.playing ? "" : undefined}
          onMouseDown={keepFocus}
          onClick={() => engine.toggle()}
        >
          <span className="led" aria-hidden />
          <Glyph name={t.playing ? "pause" : "play"} />
        </button>
        <button
          type="button"
          className="key key-l"
          aria-label="Stop"
          title="Stop, and go back to the start"
          onMouseDown={keepFocus}
          onClick={() => {
            engine.pause();
            engine.seek(t.loop?.start ?? 0);
          }}
        >
          <Glyph name="stop" />
        </button>
        <button
          type="button"
          className="key key-l"
          aria-label="Forward 5 seconds"
          title="Forward 5 seconds"
          onMouseDown={keepFocus}
          onClick={() => engine.skip(5)}
        >
          <Glyph name="forward" />
        </button>
      </div>
      <button
        type="button"
        className="key key-s tp-loop"
        aria-pressed={!!t.loop}
        title={
          t.loop
            ? `Looping ${clock(t.loop.start)} to ${clock(t.loop.end)}: press to stop`
            : "Loop the segment playing"
        }
        onMouseDown={keepFocus}
        onClick={() => runCommand(jali, "studio.loop")}
      >
        <span className="led" aria-hidden />
        loop
      </button>
      <div className="tp-controls">
        <div className="control">
          <Jog
            label="Scrub"
            value={pos}
            min={0}
            max={session.duration}
            step={1}
            degreesPerUnit={24}
            valueText={`${clock(pos)} of ${clock(session.duration)}`}
            onChange={(v) => engine.seek(v)}
          />
          <span className="legend" aria-hidden>
            scrub
          </span>
        </div>
        <div className="control tp-speed">
          <Knob
            label="Speed"
            value={Math.max(0, speed)}
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            reset={SPEEDS.indexOf(1)}
            cap="graphite"
            size={34}
            valueText={`${t.rate} times`}
            onChange={(i) => engine.setRate(SPEEDS[i]!)}
          />
          <span className="legend" aria-hidden>
            speed
          </span>
        </div>
      </div>
    </div>
  );
}

/** The transport's printed glyphs: plain geometry, like the legends on a recorder's keys. */
function Glyph({ name }: { name: "play" | "pause" | "stop" | "back" | "forward" }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden className="glyph">
      {name === "play" ? (
        <path d="M6.5 4.5v11l8.5-5.5z" />
      ) : name === "pause" ? (
        <>
          <rect x="5" y="4.5" width="3.4" height="11" rx="0.6" />
          <rect x="11.6" y="4.5" width="3.4" height="11" rx="0.6" />
        </>
      ) : name === "stop" ? (
        <rect x="5.5" y="5.5" width="9" height="9" rx="0.8" />
      ) : name === "back" ? (
        <path d="M10 5v10L3 10zM17 5v10l-7-5z" />
      ) : (
        <path d="M10 5v10l7-5zM3 5v10l7-5z" />
      )}
    </svg>
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
