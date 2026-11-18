import { useEffect, useRef, useState } from "react";
import { Command, Settings, Link2, ChevronDown, LayoutGrid } from "lucide-react";
import { useStore, useUi } from "@jali/react";
import { copyLink } from "@jali/core";
import { PALETTE_ID } from "@jali/core";
import { ReviewBar } from "@jali/react";
import { AppSwitch } from "./AppSwitch";
import { JaliLockup } from "./JaliLockup";

/** The presets as toggle buttons: in the bar on desktop, in the Layouts menu below 768px. */
function PresetButtons({ onChoose }: { onChoose?: () => void }) {
  const presetId = useUi((s) => s.presetId);
  const { actions, env } = useStore();
  return env.presets.map((p) => (
    <button key={p.id} className={`preset${presetId === p.id ? " is-active" : ""}`} aria-pressed={presetId === p.id} onClick={() => { actions.preset(p.id); onChoose?.(); }}>
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
    const down = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open]);
  return (
    <div
      className="layouts"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); }
      }}
    >
      <button ref={btn} className="layouts-btn" aria-expanded={open} aria-controls="layouts-menu" onClick={() => setOpen((o) => !o)}>
        <LayoutGrid size={14} strokeWidth={1.5} aria-hidden /> Layouts <ChevronDown size={14} strokeWidth={1.5} aria-hidden />
      </button>
      {open ? (
        <div id="layouts-menu" className="layouts-menu" role="group" aria-label="Layout presets">
          <PresetButtons onChoose={() => { setOpen(false); btn.current?.focus(); }} />
        </div>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const store = useStore();
  const review = useUi((s) => !!s.review);
  return (
    <header className="topbar" data-jali-chrome="">
      <div className="brand">
        <JaliLockup />
        <AppSwitch />
      </div>
      {review ? <ReviewBar /> : !store.env.presets.length ? null : (
        <>
          <nav className="presets" aria-label="Layout presets">
            <PresetButtons />
          </nav>
          <LayoutsMenu />
        </>
      )}
      <div className="topbar-right">
        <button className="jali-icon-btn" onClick={() => copyLink(store)} aria-label={review ? `Copy link to this ${store.env.profile?.itemNoun ?? "item"}` : "Copy link to this layout"} title="Copy link">
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button className="jali-icon-btn" onClick={() => store.set({ settingsOpen: true })} aria-label="Settings" title="Settings">
          <Settings size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button className="kbd-btn" onClick={() => store.set({ paletteOpen: true })} aria-label="Command palette">
          <Command size={14} strokeWidth={1.5} aria-hidden /> <span className="kbd-label">{store.keymap.label(PALETTE_ID)}</span>
        </button>
      </div>
    </header>
  );
}
