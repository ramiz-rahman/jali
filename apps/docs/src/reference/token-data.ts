/**
 * The public --jali-* tokens, read from the package's own CSS so the page can't drift from it: names, light and dark
 * values and the Tailwind bridge come from the files; what each token is for is written here. The coverage test
 * checks that every public token in jali-theme.css has a purpose below, and no purpose names a token that is gone.
 */
import theme from "../../../../packages/react/src/styles/jali-theme.css?raw";
import tailwind from "../../../../packages/react/src/styles/jali-tailwind.css?raw";
import workspace from "../../../../packages/react/src/styles/workspace.css?raw";
import pane from "../../../../packages/react/src/styles/pane.css?raw";
import dividers from "../../../../packages/react/src/styles/dividers.css?raw";
import shelf from "../../../../packages/react/src/styles/shelf.css?raw";
import chrome from "../../../../packages/react/src/styles/chrome.css?raw";
import page from "../../../../packages/react/src/styles/page.css?raw";
import dialogs from "../../../../packages/react/src/styles/dialogs.css?raw";
import follow from "../../../../packages/react/src/styles/follow.css?raw";

export type TokenGroup =
  | "Surfaces"
  | "Text"
  | "Accent"
  | "Status"
  | "Opened panes"
  | "Overlays and shadows"
  | "Shape and type"
  | "Derived";
export type SwatchKind = "color" | "text" | "shadow" | "scrim" | "radius" | "font";

export interface TokenInfo {
  group: TokenGroup;
  swatch: SwatchKind;
  purpose: string;
}

/** What each token is for, in the order the page lists them. */
export const TOKEN_PURPOSE: Record<string, TokenInfo> = {
  "--jali-canvas": {
    group: "Surfaces",
    swatch: "color",
    purpose:
      "The ground behind the panes. Jali paints nothing with it except the selected button of the Single / Split view switch; give your page this background to match.",
  },
  "--jali-surface": {
    group: "Surfaces",
    swatch: "color",
    purpose: "Panes, the peek sheet, dialogs, menus, the page tabs and the phone's pane switcher.",
  },
  "--jali-surface-raised": {
    group: "Surfaces",
    swatch: "color",
    purpose:
      "Dialogs and menus: the palette, the chooser, Settings, the discard dialog, the tab overflow menu and the shelf's menu.",
  },
  "--jali-border": {
    group: "Surfaces",
    swatch: "color",
    purpose: "Hairlines: pane edges, pane headers, shelf chips, dialog and palette borders.",
  },
  "--jali-border-strong": {
    group: "Surfaces",
    swatch: "color",
    purpose: "Stronger lines: the tab overflow button and menu, and a divider under the pointer.",
  },
  "--jali-control": {
    group: "Surfaces",
    swatch: "color",
    purpose:
      "Boundaries of controls (text buttons, the pane cap input). At least 3:1 against the surface, unlike the decorative border.",
  },
  "--jali-hover": {
    group: "Surfaces",
    swatch: "color",
    purpose:
      "The background of a control under the pointer: icon buttons, tab buttons, shelf chips and menu items.",
  },

  "--jali-text": {
    group: "Text",
    swatch: "text",
    purpose: "Primary text: pane titles, the active tab, menu items and inputs.",
  },
  "--jali-text-muted": {
    group: "Text",
    swatch: "text",
    purpose: "Secondary text: shelf chips, keyboard hints in the palette, dialog body text.",
  },
  "--jali-text-subtle": {
    group: "Text",
    swatch: "text",
    purpose:
      "Quieter text and icons: inactive tabs, icon buttons, palette groups, settings legends. Folded and tucked marks use it (at least 3:1).",
  },
  "--jali-text-faint": {
    group: "Text",
    swatch: "text",
    purpose:
      "The faintest marks: drag grips, the loading dot, a tab's close button, disabled palette rows.",
  },

  "--jali-accent": {
    group: "Accent",
    swatch: "color",
    purpose:
      "Focus and action: the focused pane's edge, a zoomed pane, divider handles, the drop indicator, the focused page tab, primary buttons.",
  },
  "--jali-on-accent": {
    group: "Accent",
    swatch: "color",
    purpose: "Text on the accent: the drop label and primary buttons.",
  },
  "--jali-accent-soft": {
    group: "Accent",
    swatch: "color",
    purpose:
      "A soft accent fill, for the host (the lab and the docs use it). Part of the palette and mapped by the Tailwind bridge; Jali's own styles mix their tints from the accent instead.",
  },
  "--jali-brand": {
    group: "Accent",
    swatch: "color",
    purpose:
      "Nil for the mark (#2B3990 in light), for a host that draws a logo. Part of the palette; Jali draws no mark.",
  },

  "--jali-working": {
    group: "Status",
    swatch: "color",
    purpose: 'A pane reporting "working": its activity dot and the shelf\'s spinning ring.',
  },
  "--jali-blocked": {
    group: "Status",
    swatch: "color",
    purpose: 'A pane reporting "needs-you": its activity dot and the shelf\'s "!" mark.',
  },
  "--jali-failed": {
    group: "Status",
    swatch: "color",
    purpose: 'A pane reporting "error": its activity dot and the shelf\'s cross.',
  },
  "--jali-done": {
    group: "Status",
    swatch: "color",
    purpose:
      "A finished state, for the host's own status marks. Part of the palette; a pane's activity has no \"done\".",
  },
  "--jali-on-status": {
    group: "Status",
    swatch: "color",
    purpose: 'The "!" and cross drawn on the shelf\'s status marks.',
  },

  "--jali-opened-bg": {
    group: "Opened panes",
    swatch: "color",
    purpose:
      'In a curated page, the header of a pane opened while investigating (with the "tint" boundary setting), and the Investigating group in the page bar.',
  },
  "--jali-opened-line": {
    group: "Opened panes",
    swatch: "color",
    purpose:
      'The edge and header line of an opened pane, its "Opened" tag and the Investigating group.',
  },
  "--jali-opened-mark": {
    group: "Opened panes",
    swatch: "color",
    purpose: "The small square in the page bar's Investigating group.",
  },
  "--jali-opened-ink": {
    group: "Opened panes",
    swatch: "text",
    purpose: 'The text of an opened pane\'s "Opened" tag.',
  },

  "--jali-chip": {
    group: "Overlays and shadows",
    swatch: "color",
    purpose: "The chip that follows the pointer during a drag.",
  },
  "--jali-on-chip": {
    group: "Overlays and shadows",
    swatch: "color",
    purpose: "Text on the drag chip.",
  },
  "--jali-scrim": {
    group: "Overlays and shadows",
    swatch: "scrim",
    purpose: 'The dim behind the command palette and the "Add to tabs of…" chooser.',
  },
  "--jali-scrim-light": {
    group: "Overlays and shadows",
    swatch: "scrim",
    purpose: 'The lighter dim behind Settings and "Discard unsaved changes?".',
  },
  "--jali-shadow-zoom": {
    group: "Overlays and shadows",
    swatch: "shadow",
    purpose: "A maximised (zoomed) pane.",
  },
  "--jali-shadow-peek": {
    group: "Overlays and shadows",
    swatch: "shadow",
    purpose: "The peek sheet.",
  },
  "--jali-shadow-dialog": {
    group: "Overlays and shadows",
    swatch: "shadow",
    purpose: "The palette, Settings and the discard dialog.",
  },
  "--jali-shadow-menu": {
    group: "Overlays and shadows",
    swatch: "shadow",
    purpose: "The tab overflow menu and the shelf's menu.",
  },
  "--jali-shadow-chip": {
    group: "Overlays and shadows",
    swatch: "shadow",
    purpose: "The drop label and a divider's size tip.",
  },
  "--jali-shadow-raised": {
    group: "Overlays and shadows",
    swatch: "shadow",
    purpose:
      "A slight lift, for the host's raised controls (a pressed segment). Part of the palette; Jali's own surfaces use the stronger shadows.",
  },

  "--jali-radius": {
    group: "Shape and type",
    swatch: "radius",
    purpose: "Corners of panes, the peek sheet, the drop indicator and the tab-preview outline.",
  },
  "--jali-radius-control": {
    group: "Shape and type",
    swatch: "radius",
    purpose: "Corners of buttons, inputs, palette rows and the drag chip.",
  },
  "--jali-radius-menu": {
    group: "Shape and type",
    swatch: "radius",
    purpose: "Corners of menus and the drop label.",
  },
  "--jali-font": {
    group: "Shape and type",
    swatch: "font",
    purpose: "The workspace's typeface: the workspace and its dialogs set font-family from it.",
  },
  "--jali-font-mono": {
    group: "Shape and type",
    swatch: "font",
    purpose: "Monospace: the pane cap input in Settings.",
  },

  "--jali-accent-weak": {
    group: "Derived",
    swatch: "color",
    purpose:
      "8% of the accent (14% in dark): the selected palette row, the active item in the phone's pane switcher, the tab-preview fill.",
  },
  "--jali-accent-mid": {
    group: "Derived",
    swatch: "color",
    purpose: "16% of the accent (26% in dark): the active item in the phone's pane switcher.",
  },
  "--jali-drop": {
    group: "Derived",
    swatch: "color",
    purpose: "12% of the accent (16% in dark): the zone a drag will drop into.",
  },
  "--jali-focus-ring": {
    group: "Derived",
    swatch: "color",
    purpose:
      "Keyboard focus outlines on tab buttons, shelf chips and the follow toggle. The accent unless you set it.",
  },
};

/** CSS without comments. */
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const text = bare(css);
  const at = text.indexOf(`${selector} {`);
  if (at < 0) return {};
  const body = text.slice(text.indexOf("{", at) + 1, text.indexOf("}", at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim().replace(/\s+/g, " ");
  return out;
}

const LIGHT = block(theme, ':where(:root, .light, [data-theme="light"])');
const DARK = block(theme, ':where(.dark, [data-theme="dark"])');
const PUBLIC = block(theme, ":where(:root, .light, .dark, [data-theme])");
const SHAPE = block(theme, ":where(:root)");
const DERIVED_LIGHT = block(theme, ":where(:root, [data-jali], .jali-scrim)");
const DERIVED_DARK = block(
  theme,
  ':where(.dark, [data-theme="dark"]) :where([data-jali], .jali-scrim),\n:where(.dark, [data-theme="dark"])',
);

/** Every public token a theme file declares (the --jali-default-* palette is internal). */
export function publicTokensOf(css: string): string[] {
  const all = [
    ":where(:root, .light, .dark, [data-theme])",
    ":where(:root)",
    ":where(:root, [data-jali], .jali-scrim)",
  ].flatMap((sel) => Object.keys(block(css, sel)));
  return [...new Set(all)].filter(
    (t) => t.startsWith("--jali-") && !t.startsWith("--jali-default-"),
  );
}
export const PUBLIC_TOKENS: string[] = publicTokensOf(theme);

/** A token's value in light and in dark: the default palette entry for palette tokens, the declaration otherwise. */
export function valuesOf(token: string): { light: string; dark: string } {
  const def = `--jali-default-${token.slice("--jali-".length)}`;
  if (PUBLIC[token])
    return { light: LIGHT[def] ?? PUBLIC[token]!, dark: DARK[def] ?? PUBLIC[token]! };
  if (SHAPE[token]) return { light: SHAPE[token]!, dark: SHAPE[token]! };
  const light = DERIVED_LIGHT[token] ?? "";
  return { light, dark: DERIVED_DARK[token] ?? light };
}

const PARTS_CSS = { workspace, pane, dividers, shelf, chrome, page, dialogs, follow };

/** The jali-* classes whose rules read `token` (from the package's styles), deduplicated, in file order. */
export function partsReading(token: string): string[] {
  const found: string[] = [];
  const reads = new RegExp(`var\\(${token}[,)]`);
  for (const css of Object.values(PARTS_CSS)) {
    for (const m of bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!reads.test(m[2]!)) continue;
      for (const cls of m[1]!.match(/\.jali-[a-z0-9-]+/g) ?? [])
        if (!found.includes(cls)) found.push(cls);
    }
  }
  return found;
}

export interface BridgeRow {
  token: string;
  host: string[];
  fallback: string;
}

/** The Tailwind bridge: each Jali token, the host variables it reads in order, and what it falls back to. */
export const BRIDGE: BridgeRow[] = (() => {
  const rows: BridgeRow[] = [];
  const text = bare(tailwind);
  for (const m of text.matchAll(/(--jali-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    let rest = m[2]!.trim();
    const host: string[] = [];
    // var(--a, var(--b, fallback)) → [--a, --b], fallback
    for (;;) {
      const v = /^var\((--[a-z0-9-]+)\s*,\s*([\s\S]*)\)$/.exec(rest);
      if (!v || v[1]!.startsWith("--jali-")) break;
      host.push(v[1]!);
      rest = v[2]!.trim();
    }
    rows.push({ token: m[1]!, host, fallback: rest });
  }
  return rows;
})();
