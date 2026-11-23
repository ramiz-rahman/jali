import { useEffect, useRef, useState } from "react";
import {
  CaretDownIcon,
  CommandIcon,
  GearSixIcon,
  LinkSimpleHorizontalIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { IconButton, useJaliShortcut, useJali, useJaliState, PageBar } from "jali/react";
import { copyLink } from "jali";
import { JaliLockup } from "./JaliLockup";
import type { AppChrome } from "./App";

/** The presets as toggle buttons: in the bar on desktop, in the Layouts menu below 768px. */
function PresetButtons({ onChoose }: { onChoose?: () => void }) {
  const presetId = useJaliState((s) => s.presetId);
  const { actions, presets } = useJali();
  return presets.map((p) => (
    <button
      key={p.id}
      className={`preset${presetId === p.id ? " is-active" : ""}`}
      aria-pressed={presetId === p.id}
      onClick={() => {
        actions.preset(p.id);
        onChoose?.();
      }}
    >
      {p.label}
    </button>
  ));
}

/** Below 768px the presets live behind one "Layouts" button (CSS swaps which of the two is shown). */
function LayoutsMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);
  return (
    <div
      className="layouts"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          btn.current?.focus();
        }
      }}
    >
      <button
        ref={btn}
        className="layouts-btn"
        aria-expanded={open}
        aria-controls="layouts-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <SquaresFourIcon size={14} aria-hidden /> <span className="layouts-label">Layouts</span>{" "}
        <CaretDownIcon size={14} aria-hidden />
      </button>
      {open ? (
        <div id="layouts-menu" className="layouts-menu" role="group" aria-label="Layout presets">
          <PresetButtons
            onChoose={() => {
              setOpen(false);
              btn.current?.focus();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ name, itemNoun = "item" }: AppChrome) {
  const store = useJali();
  const paletteKeys = useJaliShortcut("palette.toggle");
  const page = useJaliState((s) => !!s.page);
  return (
    <header className="topbar" data-jali-chrome="">
      <div className="brand">
        <JaliLockup />
        <span className="brand-name">{name}</span>
        {/* The people, shops and loans are generated: said at every width, so no one takes them for real. */}
        <span
          className="sample-note"
          title="Every person, business, order and loan here is made up"
        >
          Made-up data
        </span>
      </div>
      {page ? (
        <PageBar />
      ) : !store.presets.length ? null : (
        <>
          <nav className="presets" aria-label="Layout presets">
            <PresetButtons />
          </nav>
          <LayoutsMenu />
        </>
      )}
      <div className="topbar-right">
        <IconButton
          onClick={() => copyLink(store)}
          label={page ? `Copy link to this ${itemNoun}` : "Copy link to this layout"}
          title="Copy link"
        >
          <LinkSimpleHorizontalIcon size={16} aria-hidden />
        </IconButton>
        <IconButton onClick={() => store.dialogs.openSettings()} label="Settings">
          <GearSixIcon size={16} aria-hidden />
        </IconButton>
        <button
          className="kbd-btn"
          onClick={() => store.dialogs.openPalette()}
          // The name says the keys it shows (WCAG 2.5.3: what is seen is part of what is said).
          aria-label={`Command palette ${paletteKeys}`.trim()}
        >
          <CommandIcon size={14} aria-hidden /> <span className="kbd-label">{paletteKeys}</span>
        </button>
      </div>
    </header>
  );
}
