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
import { useLayoutEffect, useRef } from "react";
import { useJali, useJaliState, useShortcut, useTheme } from "@jali/react";
import { SPEEDS } from "../audio/engine";
import { usePosition, useTransport } from "../audio/react";
import { useServices } from "../services";
import { clock, clockTenths, sessionById } from "../sessions/sessions";
import { JogDial, SelectorDial } from "../ui/Knob";

/** Keys don't keep focus after a click, so Space goes on playing and pausing. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useTheme();
  const palette = useShortcut("palette.toggle");
  const slab = useFit();
  const currentLabel = jali.env.presets.find((p) => p.id === current)?.label ?? "";

  // Four groups in one row of one height: identity, layouts, the player, tools. Inside a group the keys meet at
  // hairline seams in one bezel; between groups, a wider gutter. Every key has the same face: glyph in the middle,
  // legend centred under it at one baseline, lamp in the top right corner.
  return (
    <header className="topbar" data-jali-chrome="">
      <div ref={slab} className="slab">
        {/* The identity, engraved straight into the slab. */}
        <a
          className="zone zone-id badge"
          href="./"
          aria-label="Studio, a Jali example: back to the Edit layout"
        >
          <StudioMark />
          <span className="badge-name">studio</span>
        </a>
        <div className="zone zone-layouts">
          <nav className="pocket group-layouts" aria-label="Layouts">
            {jali.env.presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="key face layout-key"
                aria-pressed={p.id === current}
                onMouseDown={keepFocus}
                onClick={() => jali.actions.preset(p.id)}
              >
                <span className="led" aria-hidden />
                <LayoutGlyph id={p.id} />
                <span className="face-legend">{p.label.toLowerCase()}</span>
              </button>
            ))}
            {/* Narrower: the four become one key that opens a menu (a real <select> under its face). */}
            <label className="key face layout-menu">
              <span className="led" data-on="" aria-hidden />
              <LayoutGlyph id={current ?? "edit"} />
              <span className="face-legend" aria-hidden>
                {currentLabel.toLowerCase()} ▾
              </span>
              <span className="sr-only">Layout</span>
              <select value={current} onChange={(e) => jali.actions.preset(e.target.value)}>
                {jali.env.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </nav>
        </div>
        <Transport />
        <div className="zone zone-tools">
          <div className="pocket group-tools" role="group" aria-label="Tools">
            <button
              type="button"
              className="key face tool-link"
              aria-label="Copy a link to this layout"
              title="Copy a link to this layout"
              onMouseDown={keepFocus}
              onClick={() => copyLink(jali)}
            >
              <LinkSimpleIcon size={22} aria-hidden className="face-glyph" />
              <span className="face-legend" aria-hidden>
                link
              </span>
            </button>
            <button
              type="button"
              className="key face"
              aria-label={theme === "dark" ? "Use the light theme" : "Use the dark theme"}
              title={theme === "dark" ? "Light theme" : "Dark theme"}
              onMouseDown={keepFocus}
              onClick={() =>
                jali.actions.changeSettings({ theme: theme === "dark" ? "light" : "dark" })
              }
            >
              {theme === "dark" ? (
                <SunIcon size={22} aria-hidden className="face-glyph" />
              ) : (
                <MoonIcon size={22} aria-hidden className="face-glyph" />
              )}
              <span className="face-legend" aria-hidden>
                {theme === "dark" ? "light" : "dark"}
              </span>
            </button>
            <button
              type="button"
              className="key face"
              aria-label="Commands"
              title={`Commands ${palette}`}
              onMouseDown={keepFocus}
              onClick={() => jali.actions.openPalette()}
            >
              <CommandIcon size={22} aria-hidden className="face-glyph" />
              <span className="face-legend" aria-hidden>
                {palette || keyHint("Mod+K")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * How the slab gives way: by the room it has, measured, never by guessed window widths. Each step (`data-f1` to
 * `data-f11` on the slab, cumulative) takes something out or tightens something, in a fixed order; on every
 * resize, and once the fonts have loaded, the slab starts from nothing taken away and takes steps until its content
 * fits. So two parts can never overlap or overflow, at any width, zoom or font. Steps, in order:
 *
 *   1 the scrub dial's "10 s/turn" note, and narrower dial caps   7 the scrub dial
 *   2 tighter gaps and padding, slightly narrower keys            8 the loop and link keys
 *   3 a narrower display                                          9 the stop key; slightly shorter keys
 *   4 the speed dial                                              10 two tiers (a phone)
 *   5 the studio name                                             11 the stop key again, in two tiers
 *   6 the four layout keys fold into one menu key
 */
export const FIT_STEPS = 11;

function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (level: number) => {
      for (let i = 1; i <= FIT_STEPS; i++) {
        if (i <= level) el.setAttribute(`data-f${i}`, "");
        else el.removeAttribute(`data-f${i}`);
      }
    };
    const fits = () => el.scrollWidth <= el.clientWidth + 0.5;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      let level = 0;
      set(0);
      while (level < FIT_STEPS && !fits()) set(++level);
      el.dataset.fit = String(level);
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            frame = requestAnimationFrame(measure);
          })
        : null;
    ro?.observe(el);
    void document.fonts?.ready.then(measure);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

function Transport() {
  const { engine } = useServices();
  const jali = useJali();
  const t = useTransport((s) => s);
  const session = sessionById(t.session)!;
  const pos = usePosition(false, 0.05);
  const ready = t.status === "ready";
  // Scrubbing holds playback while the hand is on the wheel, and carries on from where it lets go: no audio restarts
  // on every pixel of the drag.
  const wasPlaying = useRef(false);
  const startScrub = () => {
    wasPlaying.current = engine.get().playing;
    engine.pause();
  };
  const endScrub = () => {
    if (wasPlaying.current) engine.play();
    wasPlaying.current = false;
  };
  const key = (
    label: string,
    legend: string,
    glyph: Parameters<typeof Glyph>[0]["name"],
    onClick: () => void,
    extra: {
      className?: string;
      disabled?: boolean;
      on?: boolean;
      pressed?: boolean;
      title?: string;
      /** A key that latches carries a lamp; the others don't. */
      latch?: boolean;
    } = {},
  ) => (
    <button
      type="button"
      className={`key face transport-key ${extra.className ?? ""}`}
      aria-label={label}
      title={extra.title ?? label}
      disabled={extra.disabled}
      aria-pressed={extra.pressed}
      data-on={extra.on ? "" : undefined}
      onMouseDown={keepFocus}
      onClick={onClick}
    >
      {extra.latch ? <span className="led" aria-hidden /> : null}
      <Glyph name={glyph} />
      <span className="face-legend" aria-hidden>
        {legend}
      </span>
    </button>
  );
  return (
    <div className="zone zone-player" role="group" aria-label="Transport">
      <div className="zone-row">
        {/* The display: glass bonded flush into its own cutout. Title and series on the first line, the clock and
          state on the second, the progress across the foot. */}
        <div className="cutout player-cutout">
          <div className="screen player-display">
            <div className="pd-line">
              {/* Loading and failure take the title's place, so the time row never has to make room for them. */}
              {t.status === "ready" ? (
                <span className="pd-title">{session.title}</span>
              ) : (
                <span className="pd-title pd-alert">
                  {t.status === "loading" ? "loading the audio…" : "no audio"}
                </span>
              )}
              <span className="pd-show">
                {session.show} · ep {session.episode}
              </span>
            </div>
            <div className="pd-time" aria-label={`${clock(pos)} of ${clock(session.duration)}`}>
              <span className="tp-now">{clockTenths(pos)}</span>
              <span className="pd-total">/ {clock(session.duration)}</span>
              <span className="pd-state" role="status">
                {t.status === "error" ? (
                  "✕"
                ) : (
                  <>
                    {t.playing ? "▶" : "■"}
                    <span className="pd-state-word"> {t.playing ? "play" : "stop"}</span>
                  </>
                )}
                <span className="pd-rate"> · {t.rate}×</span>
              </span>
            </div>
            <div className="pd-progress" aria-hidden>
              <span style={{ width: `${(pos / session.duration) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="pocket group-transport">
          {key("Back 5 seconds", "back", "back", () => engine.skip(-5))}
          {key(
            t.playing ? "Pause" : "Play",
            t.playing ? "pause" : "play",
            t.playing ? "pause" : "play",
            () => engine.toggle(),
            {
              className: "key-accent key-play",
              latch: true,
              disabled: !ready,
              on: t.playing,
              title: `${t.playing ? "Pause" : "Play"} (Space)`,
            },
          )}
          {key(
            "Stop",
            "stop",
            "stop",
            () => {
              engine.pause();
              engine.seek(t.loop?.start ?? 0);
            },
            { className: "tp-stop", title: "Stop, and go back to the start" },
          )}
          {key("Forward 5 seconds", "fwd", "forward", () => engine.skip(5))}
          {key("Loop", "loop", "loop", () => runCommand(jali, "studio.loop"), {
            className: "tp-loop",
            latch: true,
            pressed: !!t.loop,
            title: t.loop
              ? `Looping ${clock(t.loop.start)} to ${clock(t.loop.end)}: press to stop`
              : "Loop the segment playing",
          })}
        </div>
        <div className="pocket group-rotary">
          <div className="face rotary tp-scrub">
            <JogDial
              label="Scrub"
              value={pos}
              min={0}
              max={session.duration}
              secondsPerTurn={10}
              valueText={`${clock(pos)} of ${clock(session.duration)}`}
              onStart={startScrub}
              onChange={(v) => engine.seek(v)}
              onEnd={endScrub}
              className="rotary-control"
            />
            <span className="rotary-note" aria-hidden>
              10 s/turn
            </span>
            <span className="face-legend" aria-hidden>
              scrub
            </span>
          </div>
          <div className="face rotary tp-speed">
            <SelectorDial
              label="Speed"
              values={SPEEDS}
              value={(SPEEDS.includes(t.rate as never) ? t.rate : 1) as (typeof SPEEDS)[number]}
              reset={1}
              format={(r) => `${r}×`}
              onChange={(r) => engine.setRate(r)}
              className="rotary-control"
            />
            <span className="rotary-note rotary-value" aria-hidden>
              {t.rate}×
            </span>
            <span className="face-legend" aria-hidden>
              speed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The transport's printed glyphs: plain geometry, one stroke weight, like the legends on a recorder's keys. */
function Glyph({ name }: { name: "play" | "pause" | "stop" | "back" | "forward" | "loop" }) {
  return (
    <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden className="face-glyph glyph">
      {name === "play" ? (
        <path d="M6.5 4.5v11l8.5-5.5z" />
      ) : name === "pause" ? (
        <>
          <rect x="5.5" y="4.5" width="3" height="11" />
          <rect x="11.5" y="4.5" width="3" height="11" />
        </>
      ) : name === "stop" ? (
        <rect x="5.5" y="5.5" width="9" height="9" />
      ) : name === "back" ? (
        <path d="M10 5v10L3 10zM17 5v10l-7-5z" />
      ) : name === "forward" ? (
        <path d="M10 5v10l7-5zM3 5v10l7-5z" />
      ) : (
        <path
          d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H15m0 0-2.5-2.5M15 5l-2.5 2.5M16 11v1.5A2.5 2.5 0 0 1 13.5 15H5m0 0 2.5 2.5M5 15l2.5-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="square"
        />
      )}
    </svg>
  );
}

/** Each layout drawn as its own small plan: where its panes sit. */
function LayoutGlyph({ id }: { id: string }) {
  const r = (x: number, y: number, w: number, h: number) => (
    <rect x={x} y={y} width={w} height={h} fill="none" stroke="currentColor" strokeWidth="1.3" />
  );
  return (
    <svg viewBox="0 0 22 16" width="29" height="21" aria-hidden className="face-glyph">
      {id === "mix" ? (
        <>
          {r(1, 1, 4, 14)}
          {r(7, 1, 10, 5)}
          {r(7, 8, 10, 7)}
          {r(19, 1, 2, 14)}
        </>
      ) : id === "review" ? (
        <>
          {r(1, 1, 4, 10)}
          {r(7, 1, 7, 10)}
          {r(16, 1, 5, 5)}
          {r(16, 7, 5, 4)}
          {r(1, 13, 20, 2)}
        </>
      ) : id === "compare" ? (
        <>
          {r(1, 1, 4, 14)}
          {r(7, 1, 6, 9)}
          {r(7, 12, 6, 3)}
          {r(15, 1, 3, 14)}
          {r(19, 1, 2, 14)}
        </>
      ) : (
        <>
          {r(1, 1, 4, 14)}
          {r(7, 1, 9, 9)}
          {r(7, 12, 9, 3)}
          {r(18, 1, 3, 14)}
        </>
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
