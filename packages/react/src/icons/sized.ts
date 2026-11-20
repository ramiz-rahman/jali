/**
 * Where Jali draws an icon, and how big. Each place reads a size token from CSS (`--jali-icon-header`, `-tab`,
 * `-menu`, `-shelf`), and a few icons sit a fixed step from their place's size: a pane's title icon 2px larger, small
 * marks 1 or 2px smaller. Jali passes an icon the class that sizes it (styles/icons.css) and the default size as
 * `size`, so a custom icon that applies `className` follows the tokens, and one that ignores it keeps the default.
 */
export const ICON = {
  /** The header's buttons, its grip, the peek's buttons. */
  header: { size: 14, className: "jali-icon-header" },
  /** A pane's title icon, in its header and the peek's: the header's size + 2px. */
  title: { size: 16, className: "jali-icon-header-lg" },
  /** The Following / Kept toggle's icon: the header's size − 2px. */
  headerSmall: { size: 12, className: "jali-icon-header-sm" },
  /** A tab's icon, its close and put back buttons, New tab, the pane switcher's icons. */
  tab: { size: 14, className: "jali-icon-tab" },
  /** A folded tab's mark: the tab's size − 1px. */
  tabMark: { size: 13, className: "jali-icon-tab-mark" },
  /** A pinned tab's pin, and the "+N" and "N folded" chips' icons: the tab's size − 2px. */
  tabSmall: { size: 12, className: "jali-icon-tab-sm" },
  /** A pane's icon in a tab menu, the "+N" menu and the shelf's menu. */
  menu: { size: 14, className: "jali-icon-menu" },
  /** A menu's check mark: the menu's size − 1px. */
  menuMark: { size: 13, className: "jali-icon-menu-mark" },
  /** A menu item's folded or tucked mark: the menu's size − 2px. */
  menuSmall: { size: 12, className: "jali-icon-menu-sm" },
  /** A shelf chip's icon, its fold mark and its put back button. */
  shelf: { size: 13, className: "jali-icon-shelf" },
} as const;
