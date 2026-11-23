/** How the review says things: money, rates, terms, dates and counts in an underwriter's words. Pure. */
import { guidelines, isLine } from "./programs";
import type { Mortgage, Program, Purpose, RateType } from "./rows";
import type { Book, Paid } from "./underwriting";

/** Whole dollars from cents: "$485,000". */
export const usd = (cents: number) =>
  `${cents < 0 ? "−" : ""}$${Math.round(Math.abs(cents) / 100).toLocaleString("en-US")}`;

/** Dollars in short: "$485K", "$1.45M". */
export function usdShort(cents: number) {
  const d = Math.abs(cents) / 100;
  const sign = cents < 0 ? "−" : "";
  if (d >= 1_000_000)
    return `${sign}$${(d / 1_000_000).toFixed(d >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (d >= 10_000) return `${sign}$${Math.round(d / 1000)}K`;
  return usd(cents);
}

/** A rate in percent, as lenders quote it: "7.125%", "6.75%", "7%". */
export const rate = (percent: number) => `${Number(percent.toFixed(3))}%`;

/** A ratio as a percent: "78.4%", or whole ("80%") when it is. */
export function pct(ratio: number, digits = 1) {
  const v = ratio * 100;
  return `${Number.isInteger(Math.round(v * 10) / 10) ? Math.round(v) : v.toFixed(digits)}%`;
}

/** A term in months, as said: "30-year", "15-year", "18 months". */
export const term = (months: number) => (months % 12 ? `${months} months` : `${months / 12}-year`);

/**
 * A loan's term as said, or a line's draw and repayment: "30-year", "10-year draw, 20-year repayment"; `brief`, a
 * line's draw alone: "10-year draw".
 */
export function loanTerm(x: { program: Program; term_months: number }, brief = false) {
  const draw = guidelines(x.program).draw;
  if (!draw) return term(x.term_months);
  const drawn = `${draw.drawYears}-year draw`;
  return brief ? drawn : `${drawn}, ${draw.repayYears}-year repayment`;
}

/** How the rate moves, in a sentence: "fixed", "variable", "7/6 ARM". */
export const rateKind = ({ rate_type: r }: { rate_type: RateType }) =>
  r.kind === "arm" ? `${r.fixedYears}/${r.adjustsMonths} ARM` : r.kind;

/** The product as a reviewer says it: "Conventional 30-year fixed", "Home equity loan, 15-year fixed", "HELOC". */
export function product(loan: { program: Program; term_months: number; rate_type: RateType }) {
  if (isLine(loan)) return loan.program;
  const name = guidelines(loan.program).productName;
  return `${name ? `${name},` : loan.program} ${term(loan.term_months)} ${rateKind(loan)}`;
}

/** What the amount is called, in short: a line or a loan. */
export const amountShort = (x: { program: Program }) => (isLine(x) ? "Line" : "Loan");
/** What the amount is called: "Line amount", "Loan amount". */
export const amountLabel = (x: { program: Program }) => `${amountShort(x)} amount`;

/** A purpose in the queue's few words. */
const PURPOSE_SHORT: Record<Purpose, string> = {
  Purchase: "purchase",
  "Rate-and-term refinance": "refinance",
  "Cash-out refinance": "cash-out",
  "Home equity line": "line",
  "Home equity loan": "loan",
};
export const purposeShort = (purpose: Purpose) => PURPOSE_SHORT[purpose];

/** A mortgage's lien as an ordinal, "1st" or "2nd", and as a word, "first" or "second". */
const lienOrdinal = (mortgage: Pick<Mortgage, "lien_position">) =>
  mortgage.lien_position === 2 ? "2nd" : "1st";
export const lienWord = (mortgage: Pick<Mortgage, "lien_position">) =>
  mortgage.lien_position === 2 ? "second" : "first";
/** A mortgage by its lien and when it began: "2nd lien · Jun 2021". */
export const lienLine = (mortgage: Pick<Mortgage, "lien_position" | "originated_on">) =>
  `${lienOrdinal(mortgage)} lien · ${monthYear(mortgage.originated_on)}`;

/**
 * Dates, one way: an ISO date or timestamp read in UTC (as the database writes them) and said day first, as Data
 * Studio's cells say them. Anything that isn't a date is said as it came.
 */
const DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** A date's day, month and year, or undefined when `v` isn't one. */
function dateParts(v: string) {
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = Object.fromEntries(DATE.formatToParts(date).map((part) => [part.type, part.value]));
  return { date, day: parts.day, month: parts.month, year: parts.year };
}

/** A date without its time: "4 Nov 2026". */
export function day(v: string) {
  const d = dateParts(v);
  return d ? `${d.day} ${d.month} ${d.year}` : v;
}

/** The day and month: "4 Nov". */
export function monthDay(v: string) {
  const d = dateParts(v);
  return d ? `${d.day} ${d.month}` : v;
}

/** The month and year: "Jun 2021". */
export function monthYear(v: string) {
  const d = dateParts(v);
  return d ? `${d.month} ${d.year}` : v;
}

/** A date with its time when it has one: "2 Nov 2026, 09:00". */
export function when(v: string) {
  const d = dateParts(v);
  if (!d) return v;
  return /T\d{2}:\d{2}/.test(v) ? `${day(v)}, ${TIME.format(d.date)}` : day(v);
}

/** A noun's plural, as the review makes them: "loan" is "loans". */
export const pluralOf = (one: string) => `${one}s`;

export const plural = (count: number, one: string, many = pluralOf(one)) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
/**
 * "13 loans", "One other application", "No other applications": a count as a reader says it. Before the count is
 * known, the plural alone, as a heading: "Other applications".
 */
export function counted(count: number | undefined, one: string, many = pluralOf(one)) {
  if (count === undefined) return `${many[0]!.toUpperCase()}${many.slice(1)}`;
  if (count < 10) return `${WORDS[count]} ${count === 1 ? one : many}`;
  return plural(count, one, many);
}

/** Whole years between two ISO dates, "less than a year" under one. */
export function tenure(since: string, until: string): string {
  const from = new Date(since),
    to = new Date(until);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
  const years = Math.floor((to.getTime() - from.getTime()) / (365.25 * 864e5));
  return years < 1 ? "less than a year" : plural(years, "year");
}

/** "11 of 12 on time", or "11 of 12 payments on time". */
export const onTime = (paid: Paid, noun?: string) =>
  `${paid.onTime} of ${paid.total}${noun ? ` ${noun}` : ""} on time`;

/** What wasn't on time: "1 late, 2 missed". */
export const offTime = (paid: Paid) =>
  [paid.late && `${paid.late} late`, paid.missed && `${paid.missed} missed`]
    .filter(Boolean)
    .join(", ");

/** What a borrower owes us now, in a line: "$412,000 owed", "Paid in full", "None". */
export const owed = (book: Book) =>
  book.loans ? (book.open ? `${usd(book.balance)} owed` : "Paid in full") : "None";

/** A borrower's mortgages with us, in a line: "3 loans · 1 delinquent · 11 of 12 payments on time". */
export function historyLine(book: Book, paid: Paid | undefined) {
  if (!book.loans) return "No payment history with us";
  return [
    plural(book.loans, "loan"),
    book.delinquent && `${book.delinquent} delinquent`,
    paid?.total && onTime(paid, "payments"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Initials from a name: "Emily Carter" is "EC". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Who is borrowing: "Emily & James Carter", "Marcus Johnson". */
export function household(name: string, coBorrower: string | null) {
  if (!coBorrower) return name;
  const [first, ...last] = name.split(" ");
  const [coFirst, ...coLast] = coBorrower.split(" ");
  const surname = last.join(" ");
  return surname === coLast.join(" ")
    ? `${first} & ${coFirst} ${surname}`
    : `${name} & ${coBorrower}`;
}

/** The city line of an address: "Austin, TX 78704". */
export const cityLine = (place: { city: string; state: string; zip: string }) =>
  `${place.city}, ${place.state} ${place.zip}`;
