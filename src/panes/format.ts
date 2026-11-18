import type { ColumnInfo } from "../data/types";

export const NUMERIC_TYPES =
  /^(int|integer|bigint|smallint|numeric|decimal|real|double|float|serial)/i;
export const isNumericType = (type: string) => NUMERIC_TYPES.test(type.trim());

/** Column header text: money columns drop "_cents" and read as a plain title ("unit_price_cents" -> "Unit price"). */
export function columnLabel(name: string, format?: ColumnInfo["format"]): string {
  if (format !== "money") return name;
  const words = name
    .replace(/_cents$/, "")
    .split("_")
    .filter(Boolean)
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Minor units as money: 12500 -> "125.00". */
export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const stamp = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const day = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const partsOf = (f: Intl.DateTimeFormat, d: Date) =>
  Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));

/** ISO timestamp -> "1 Jan 2026, 10:30" (UTC, 24-hour); date only -> "1 Jan 2026". Anything else -> null. */
export function formatTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = ISO.exec(value.trim());
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const d = new Date(
    hasTime
      ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${m[6] ?? "Z"}`.replace(
          /([+-]\d{2})(\d{2})$/,
          "$1:$2",
        )
      : `${m[1]}-${m[2]}-${m[3]}T00:00:00Z`,
  );
  if (Number.isNaN(d.getTime())) return null;
  const p = partsOf(hasTime ? stamp : day, d);
  const month = p.month === "Sept" ? "Sep" : p.month;
  const date = `${p.day} ${month} ${p.year}`;
  return hasTime ? `${date}, ${p.hour}:${p.minute}` : date;
}

/** JSON text on one line with no extra spaces. Invalid JSON is returned as it came. */
export function formatJson(text: string, pretty = false): string {
  try {
    return JSON.stringify(JSON.parse(text), null, pretty ? 2 : undefined);
  } catch {
    return text;
  }
}

export type CellKind = "null" | "money" | "time" | "json" | "number" | "text";
export function cellKind(
  value: string | number | null | undefined,
  column?: { name: string; type?: string; format?: ColumnInfo["format"] },
): CellKind {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return column?.format === "money" ? "money" : "number";
  if (column?.format === "json") return "json";
  return formatTimestamp(value) !== null ? "time" : "text";
}

/** The value as stored: ISO text, raw cents, raw JSON. Used for tooltips and copy. */
export const rawText = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "NULL" : String(value);

/** Display text for one cell. null is rendered as a chip by the caller; this returns "" for null. */
export function formatCell(
  value: string | number | null | undefined,
  column?: { name: string; type?: string; format?: ColumnInfo["format"] },
): string {
  switch (cellKind(value, column)) {
    case "null":
      return "";
    case "money":
      return formatMoney(value as number);
    case "number":
      return Number.isInteger(value) ? (value as number).toLocaleString("en-US") : String(value);
    case "time":
      return formatTimestamp(value) ?? String(value);
    case "json":
      return formatJson(String(value));
    default:
      return String(value);
  }
}

/** Counts: 1,234. */
export const formatCount = (n: number) => n.toLocaleString("en-US");

/** Short duration for run stats. */
export const formatMs = (ms: number) =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;

/** Compact axis number: 1.2k, 3.4M. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3)}k`;
  return trim(n);
}
const trim = (n: number) => String(Math.round(n * 10) / 10);
