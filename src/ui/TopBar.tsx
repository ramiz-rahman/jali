import { Command, Settings, Link2 } from "lucide-react";
import { PRESETS } from "./presets";
import { actions, setState, useUi } from "./store";
import { copyLink } from "./commands";
import { isMac } from "./keyboard";

export function TopBar() {
  const presetId = useUi((s) => s.presetId);
  const adapter = useUi((s) => s.settings.adapter);
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
      <div className="topbar-right">
        <span className="adapter-tag" title="Resize adapter (Settings)">{adapter === "own" ? "Own separator" : "Ark Splitter"}</span>
        <button className="icon-btn" onClick={() => copyLink()} aria-label="Copy link to this layout" title="Copy link">
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button className="icon-btn" onClick={() => setState({ settingsOpen: true })} aria-label="Settings" title="Settings">
          <Settings size={16} strokeWidth={1.5} aria-hidden />
        </button>
        <button className="kbd-btn" onClick={() => setState({ paletteOpen: true })} aria-label="Command palette">
          <Command size={14} strokeWidth={1.5} aria-hidden /> <span>{isMac ? "⌘K" : "Ctrl K"}</span>
        </button>
      </div>
    </header>
  );
}
