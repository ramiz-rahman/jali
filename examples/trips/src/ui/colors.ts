/**
 * Each day has its own colour, on the map and in the lists, taken from Nava's categorical chart palette (coral,
 * teal, blue, violet, amber). The CSS sets the same values as `--day` under `[data-day]` (styles/tokens.css);
 * MapLibre needs them as plain strings, so they are written here too. Keep the two in step.
 *
 * Colour never stands alone: every pin carries its day's number, and every list names the day.
 */
export const DAY_COLORS = {
  light: ["#c04a35", "#0f8290", "#3d63d4", "#8b4cc4", "#9a6f00"],
  dark: ["#f07a62", "#3cc0cc", "#7c9bf5", "#bb8cf0", "#e0b440"],
} as const;

export const dayColor = (n: number, theme: "light" | "dark") =>
  DAY_COLORS[theme][(n - 1) % DAY_COLORS[theme].length]!;
