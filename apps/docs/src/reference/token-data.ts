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
import icons from "../../../../packages/react/src/styles/icons.css?raw";

export type TokenGroup =
  | "Surfaces"
  | "Text"
  | "Accent"
  | "Status"
  | "Panes"
  | "Opened panes"
  | "Overlays and shadows"
  | "Shape and type"
  | "Derived";
export type SwatchKind =
  | "color"
  | "text"
  | "shadow"
  | "scrim"
  | "radius"
  | "font"
  | "size"
  | "type"
  | "tracking";

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
      "The ground behind the panes. Jali paints nothing with it except the selected button of the Single view / Split view switch; give your page this background to match.",
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
      "A soft accent fill, for the host (the example apps and the docs use it). Part of the palette and mapped by the Tailwind bridge; Jali's own styles mix their tints from the accent instead.",
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
  "--jali-live": {
    group: "Status",
    swatch: "color",
    purpose:
      'A pane reporting "live" (recording, streaming, playback): its activity dot and the shelf\'s breathing dot in a halo.',
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

  "--jali-pane-border": {
    group: "Panes",
    swatch: "color",
    purpose:
      "The colour of a pane's 1px edge. Read in place, defaulting to `--jali-border`. An opened pane with the tint boundary uses `--jali-opened-line` instead.",
  },
  "--jali-pane-border-focused": {
    group: "Panes",
    swatch: "color",
    purpose: "The focused pane's edge. Read in place, defaulting to `--jali-accent`.",
  },
  "--jali-pane-shadow": {
    group: "Panes",
    swatch: "shadow",
    purpose:
      "A pane's shadow at rest, and the focused pane's while a pane is dragged. Read in place, defaulting to `none`. A lone pane and Single view draw no shadow or edge.",
  },
  "--jali-pane-shadow-focused": {
    group: "Panes",
    swatch: "shadow",
    purpose:
      "The focused pane's shadow, which is also its focus ring: a 0.5px accent ring by default. A maximised pane draws it under `--jali-shadow-zoom`, so give it a list of shadows (`0 0 #0000` for none), not `none`.",
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
    purpose:
      "Corners of panes, the peek sheet, the drop indicator and the tab-preview outline. Dialogs (the palette, the chooser, Settings and the discard question) are 1.2 × this, rounded down to a whole pixel.",
  },
  "--jali-radius-control": {
    group: "Shape and type",
    swatch: "radius",
    purpose: "Corners of buttons, inputs, palette rows, the drag chip and the tab preview's label.",
  },
  "--jali-radius-menu": {
    group: "Shape and type",
    swatch: "radius",
    purpose: "Corners of menus and the drop label.",
  },
  "--jali-radius-chip": {
    group: "Shape and type",
    swatch: "radius",
    purpose:
      "Corners of small things inside a header, tab or chip: the Following / Kept toggle, a tab's close button, the rename field, the Kept badge and the peek's label. Shelf chips and their buttons, the shelf's \"more\" and its items, and tab menu items are 1.25 × this; investigation chips 1.75 ×, each rounded down to a whole pixel.",
  },
  "--jali-icon-header": {
    group: "Shape and type",
    swatch: "size",
    purpose:
      "Icons in a pane's header: its buttons, its grip and the peek's buttons. A pane's title icon is this + 2px, the Following / Kept toggle's icon this − 2px.",
  },
  "--jali-icon-tab": {
    group: "Shape and type",
    swatch: "size",
    purpose:
      "Icons in a tab: its kind's icon, close, put back, New tab, and the pane switcher's icons. A folded tab's mark is this − 1px; a pinned tab's pin and the \"+N\" and \"N folded\" chips' icons this − 2px.",
  },
  "--jali-icon-menu": {
    group: "Shape and type",
    swatch: "size",
    purpose:
      "A pane's icon in a tab menu, the \"+N\" menu and the shelf's menu. The check mark is this − 1px, a folded or tucked mark this − 2px.",
  },
  "--jali-icon-shelf": {
    group: "Shape and type",
    swatch: "size",
    purpose: "Icons in a shelf chip: the pane's icon, the fold mark and Put back.",
  },
  "--jali-dialog-padding": {
    group: "Shape and type",
    swatch: "size",
    purpose:
      "The space between a dialog's edge and its content: all round in Settings (but its top, beside the title) and the discard question; at the sides of the palette's and the chooser's field and heading. Their lists keep their rows' own inset.",
  },
  "--jali-text-xs": {
    group: "Shape and type",
    swatch: "type",
    purpose:
      'The smallest type: key hints, the Following / Kept toggle, badges, the "+N" and "N folded" chips, menu marks, the peek\'s label and Settings\' legends.',
  },
  "--jali-text-sm": {
    group: "Shape and type",
    swatch: "type",
    purpose:
      "Small type: the shelf, tab menus, palette groups, the chooser's heading, notes in a pane, the drag chip and a divider's size tip. The investigation chips on a curated page are this + 0.0312rem (12.5px).",
  },
  "--jali-text-md": {
    group: "Shape and type",
    swatch: "type",
    purpose: "A pane's title, the phone's pane switcher and a popped-out pane's note.",
  },
  "--jali-text-lg": {
    group: "Shape and type",
    swatch: "type",
    purpose:
      "The palette's field, the titles of Settings and the discard question, and the drop label.",
  },
  "--jali-tracking": {
    group: "Shape and type",
    swatch: "tracking",
    purpose:
      "Letter spacing for Jali's panes and dialogs (a length, such as `0.01em`). Read in place with no default: until you set it, they inherit yours. Settings' small capitals keep their own 0.04em.",
  },
  "--jali-font": {
    group: "Shape and type",
    swatch: "font",
    purpose: "Jali's typeface: the panes and dialogs set font-family from it.",
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

/**
 * Every light-dark(light, dark) in a value replaced by one side: Jali's palette is written once, and the browser picks
 * the side by the color-scheme where a token is used.
 */
function side(value: string, which: 0 | 1): string {
  let out = value;
  for (;;) {
    const at = out.indexOf("light-dark(");
    if (at < 0) return out;
    let depth = 0,
      comma = -1,
      end = -1;
    for (let i = at + "light-dark(".length - 1; i < out.length; i++) {
      const c = out[i];
      if (c === "(") depth++;
      else if (c === ")" && --depth === 0) {
        end = i;
        break;
      } else if (c === "," && depth === 1 && comma < 0) comma = i;
    }
    const args = [out.slice(at + "light-dark(".length, comma), out.slice(comma + 1, end)];
    out = out.slice(0, at) + args[which]!.trim() + out.slice(end + 1);
  }
}

/** The root's block: the default palette, the public tokens and shape and type. */
const ROOT = block(theme, ":where(:root)");
const DERIVED = block(theme, ":where(:root, [data-jali], .jali-scrim)");

/** Every token a theme file declares on the root (the --jali-default-* palette is internal). */
function declaredTokensOf(css: string): string[] {
  const all = [":where(:root)", ":where(:root, [data-jali], .jali-scrim)"].flatMap((sel) =>
    Object.keys(block(css, sel)),
  );
  return [...new Set(all)].filter(
    (t) => t.startsWith("--jali-") && !t.startsWith("--jali-default-"),
  );
}

/**
 * The tokens read in place: not declared on the root, but read by the parts with their default where they are used
 * (`var(--jali-pane-border, var(--jali-border))`), so a default that names another token resolves on the part. The
 * theme lists them in a comment that starts "Read in place", one `--jali-name: default;` a line, the default `(none)`
 * when there is none (the property then inherits). The coverage test checks the parts read each with exactly this default.
 */
export function inPlaceTokensOf(css: string): Record<string, string> {
  const list = /Read in place[\s\S]*?\*\//.exec(css)?.[0] ?? "";
  const out: Record<string, string> = {};
  for (const m of list.matchAll(/^\s*\*?\s*(--jali-[a-z0-9-]+):\s*([^;]+);/gm))
    out[m[1]!] = m[2]!.trim().replace(/\s+/g, " ");
  return out;
}

/**
 * Every `var(--jali-…)` in some CSS, each with its fallback: the text after the comma, or `(none)` when it has none.
 */
export function readsOf(css: string): { token: string; fallback: string }[] {
  const text = bare(css);
  const out: { token: string; fallback: string }[] = [];
  for (const m of text.matchAll(/var\((--jali-[a-z0-9-]+)\s*([,)])/g)) {
    if (m[2] === ")") {
      out.push({ token: m[1]!, fallback: "(none)" });
      continue;
    }
    let depth = 1,
      i = m.index! + m[0].length;
    const start = i;
    for (; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")" && --depth === 0) break;
    }
    out.push({ token: m[1]!, fallback: text.slice(start, i).trim().replace(/\s+/g, " ") });
  }
  return out;
}

/** Every public token a theme file names: declared on the root, or read in place. */
export function publicTokensOf(css: string): string[] {
  return [...new Set([...declaredTokensOf(css), ...Object.keys(inPlaceTokensOf(css))])];
}
export const PUBLIC_TOKENS: string[] = publicTokensOf(theme);
const IN_PLACE = inPlaceTokensOf(theme);

/** A token read in place: its default there, for `var(token, default)` in a swatch; undefined for a declared one. */
export const inPlaceDefault = (token: string): string | undefined =>
  IN_PLACE[token] && IN_PLACE[token] !== "(none)" ? IN_PLACE[token] : undefined;

/**
 * A token's value in light and in dark: the default palette entry for palette tokens, the declaration otherwise, and
 * for a token read in place, its default there ("inherited" when it has none).
 */
export function valuesOf(token: string): { light: string; dark: string } {
  const inPlace = IN_PLACE[token] === "(none)" ? "inherited" : IN_PLACE[token];
  const value =
    ROOT[`--jali-default-${token.slice("--jali-".length)}`] ??
    ROOT[token] ??
    DERIVED[token] ??
    inPlace ??
    "";
  return { light: side(value, 0), dark: side(value, 1) };
}

const PARTS_CSS = { workspace, pane, dividers, shelf, chrome, page, dialogs, follow, icons };

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
