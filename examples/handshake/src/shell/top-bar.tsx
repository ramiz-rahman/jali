/**
 * The top bar: the app's name, the layouts to start from (Jali's presets, as buttons on wide screens and a select on
 * narrow ones), the theme, and ⌘K. Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout
 * change.
 */
import { keyHint } from "jali";
import { Moon, Sun } from "lucide-react";
import { useJali, useJaliShortcut, useJaliState, useJaliTheme } from "jali/react";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { GlitchText } from "#src/vendor/cyberspec/components/ui/glitch-text.tsx";
import { Micro } from "#src/vendor/cyberspec/components/ui/micro.tsx";
import { Select } from "#src/vendor/cyberspec/components/ui/select.tsx";

export function TopBar() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const theme = useJaliTheme();
  const palette = useJaliShortcut("palette.toggle") || keyHint("Mod+K");
  const presets = jali.presets;

  return (
    <header className="topbar" data-jali-chrome="">
      {/* Named by what it shows, "Handshake" (the micro-print beside it is decoration); the title says where it goes. */}
      <a className="brand" href="./" title="Back to the first layout">
        <GlitchText className="brand-name">Handshake</GlitchText>
        <Micro className="brand-micro" aria-hidden>
          NET.LAB // JALI
        </Micro>
      </a>
      <nav className="topbar-presets" aria-label="Layouts">
        {presets.map((p) => (
          <Button
            key={p.id}
            size="sm"
            tone={p.id === current ? "primary" : "ghost"}
            aria-pressed={p.id === current}
            onClick={() => jali.actions.preset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </nav>
      <div className="topbar-presets-select">
        <Select
          label="Layout"
          value={current ?? null}
          onValueChange={(id) => {
            if (typeof id === "string") jali.actions.preset(id);
          }}
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
        />
      </div>
      <div className="topbar-end">
        {/* An icon, so the layouts keep the room on a phone; named for what it switches to. */}
        <Button
          size="sm"
          tone="ghost"
          icon
          aria-label={theme === "dark" ? "Daylight" : "Night"}
          title={theme === "dark" ? "Switch to daylight" : "Switch to night"}
          onClick={() =>
            jali.actions.changeSettings({ theme: theme === "dark" ? "light" : "dark" })
          }
        >
          {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </Button>
        <Button
          size="sm"
          tone="secondary"
          // The name says the key it shows (WCAG 2.5.3: what is seen is part of what is said).
          aria-label={`Commands ${palette}`}
          onClick={() => jali.dialogs.openPalette()}
        >
          <kbd>{palette}</kbd>
        </Button>
      </div>
    </header>
  );
}
