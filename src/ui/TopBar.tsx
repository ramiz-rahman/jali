import { useEffect, useRef, useState } from "react";
import { Command, Settings, Link2, ChevronDown, LayoutGrid } from "lucide-react";
import { PRESETS } from "./presets";
import { actions, setState, useUi } from "./store";
import { copyLink } from "./commands";
import { isMac } from "./keyboard";

/** Below 768px the presets live behind one "Layouts" button (CSS swaps which of the two is shown). */
function LayoutsMenu() {
  const presetId = useUi((s) => s.presetId);
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
          {PRESETS.map((p) => (
            <button key={p.id} className={`preset${presetId === p.id ? " is-active" : ""}`} aria-pressed={presetId === p.id} onClick={() => { actions.preset(p.id); setOpen(false); btn.current?.focus(); }}>
              {p.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const presetId = useUi((s) => s.presetId);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark" aria-hidden />
        <span className="brand-name">Pane lab</span>
      </div>
      <nav className="presets" aria-label="Layout presets">
        {PRESETS.map((p) => (
          <button key={p.id} className={`preset${presetId === p.id ? " is-active" : ""}`} aria-pressed={presetId === p.id} onClick={() => actions.preset(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>
      <LayoutsMenu />
      <div className="topbar-right">
        <button className="icon-btn" onClick={() => copyLink()} aria-label="Copy link to this layout" title="Copy link">
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button className="icon-btn" onClick={() => setState({ settingsOpen: true })} aria-label="Settings" title="Settings">
          <Settings size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button className="kbd-btn" onClick={() => setState({ paletteOpen: true })} aria-label="Command palette">
          <Command size={14} strokeWidth={1.5} aria-hidden /> <span className="kbd-label">{isMac ? "⌘K" : "Ctrl K"}</span>
        </button>
      </div>
    </header>
  );
}
