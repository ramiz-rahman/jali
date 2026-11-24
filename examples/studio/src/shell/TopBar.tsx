/**
 * The app's top bar, inside <JaliRoot>: one slab in four groups of one height (identity, layouts, the player, tools).
 * Inside a group the keys meet at hairline seams in one bezel; between groups, a wider gutter. Every key has the same
 * face: glyph in the middle, legend centred under it at one baseline, lamp in the top right corner. It gives way as
 * the window narrows (useFit.ts).
 *
 * Marked `data-jali-chrome`, so Jali leaves keyboard focus here after a layout change.
 */
import {
  ArrowCounterClockwiseIcon,
  CommandIcon,
  LinkSimpleIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { copyLink, keyHint } from "jali-layout";
import { useJali, useJaliShortcut, useJaliState, useJaliTheme } from "jali-layout/react";
import { useServices } from "../services";
import { PlanGlyph, StudioMark } from "../ui/atoms/glyphs";
import { Lamp } from "../ui/atoms/Lamp";
import { FaceKey } from "../ui/molecules/FaceKey";
import { planOf } from "./layoutPlans";
import { Transport } from "./Transport";
import { useFit } from "./useFit";

export function TopBar() {
  const slab = useFit();
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
        <Layouts />
        <Transport />
        <Tools />
      </div>
    </header>
  );
}

/** The layouts (Jali's presets) as a row of keys; narrower, one key that opens a menu. */
function Layouts() {
  const jali = useJali();
  const current = useJaliState((s) => s.presetId);
  const presets = jali.presets;
  const currentLabel = presets.find((p) => p.id === current)?.label ?? "";
  return (
    <div className="zone zone-layouts">
      <nav className="pocket group-layouts" aria-label="Layouts">
        {presets.map((p) => (
          <FaceKey
            key={p.id}
            className="layout-key"
            latched={p.id === current}
            glyph={<PlanGlyph rects={planOf(p.id)} />}
            legend={p.label.toLowerCase()}
            onClick={() => jali.actions.preset(p.id)}
          />
        ))}
        {/* Narrower: the four become one key that opens a menu (a real <select> under its face). */}
        <label className="key face layout-menu">
          <Lamp on />
          <PlanGlyph rects={planOf(current)} />
          <span className="face-legend" aria-hidden>
            {currentLabel.toLowerCase()} ▾
          </span>
          <span className="sr-only">Layout</span>
          <select value={current} onChange={(e) => jali.actions.preset(e.target.value)}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </nav>
    </div>
  );
}

/** Reset the layout, copy its link, switch the theme, open ⌘K. */
function Tools() {
  const jali = useJali();
  const { layouts } = useServices();
  const theme = useJaliTheme();
  const palette = useJaliShortcut("palette.toggle");
  const other = theme === "dark" ? "light" : "dark";
  const glyph = (Icon: typeof SunIcon) => <Icon size={22} aria-hidden className="face-glyph" />;
  return (
    <div className="zone zone-tools">
      <div className="pocket group-tools" role="group" aria-label="Tools">
        <FaceKey
          className="tool-reset"
          aria-label="Reset this layout to its design"
          title="Reset this layout to its design"
          glyph={glyph(ArrowCounterClockwiseIcon)}
          legend="reset"
          onClick={() => void layouts.reset(jali)}
        />
        <FaceKey
          className="tool-link"
          aria-label="Copy a link to this layout"
          title="Copy a link to this layout"
          glyph={glyph(LinkSimpleIcon)}
          legend="link"
          onClick={() => copyLink(jali)}
        />
        <FaceKey
          aria-label={`Use the ${other} theme`}
          title={`${other === "light" ? "Light" : "Dark"} theme`}
          glyph={glyph(theme === "dark" ? SunIcon : MoonIcon)}
          legend={other}
          onClick={() => jali.actions.changeSettings({ theme: other })}
        />
        <FaceKey
          aria-label="⌘K: commands"
          title={`Commands ${palette}`}
          glyph={glyph(CommandIcon)}
          legend={palette || keyHint("Mod+K")}
          onClick={() => jali.dialogs.openPalette()}
        />
      </div>
    </div>
  );
}
