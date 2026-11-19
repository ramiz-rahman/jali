/** How the app writes money, time, distance and dates. */

// US dollars, the trip's one currency (prices are Thai, made up, and shown in dollars).
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdRound = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** $12.50 or $15 (no cents on a whole number), or "Free". */
export const price = (n: number) => (n === 0 ? "Free" : money(n));
/** $12.50 or $15, always a number. */
export const money = (n: number) => (Number.isInteger(n) ? usdRound : usd).format(n);
/** $1,240, for totals. */
export const moneyRound = (n: number) => usdRound.format(Math.round(n));

/** "45 min", "1h 05m". */
export function minutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${String(rest).padStart(2, "0")}m` : `${h}h`;
}

/** "14:35", from minutes after midnight. */
export const clock = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** "1.4 km", "650 m". */
export const distance = (km: number) =>
  km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;

/** "Thu 15 Apr", from an ISO date (read as a calendar date, not a moment). */
export function day(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "Thursday 15 April". */
export function dayLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
