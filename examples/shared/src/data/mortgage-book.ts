/**
 * The loan book: a fictional US home lender's borrowers, properties, mortgages and the applications in its
 * underwriting queue, for the curated loan-review workspace. Generated deterministically. Figures are set as of
 * November 2026: a 30-year fixed near 7.2% (Freddie Mac's PMMS), the 2026 baseline conforming loan limit of
 * $832,750, and each program's usual terms (FHA's 1.75% upfront premium, VA's funding fee, USDA's guarantee fee).
 */

export const loanBookTables = [
  `CREATE TABLE loan_officers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, nmls_id TEXT NOT NULL, branch TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL);`,
  `CREATE TABLE borrowers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, co_borrower TEXT, employer TEXT NOT NULL, job_title TEXT NOT NULL, years_employed INTEGER NOT NULL, annual_income_cents INTEGER NOT NULL, credit_score INTEGER NOT NULL, monthly_debts_cents INTEGER NOT NULL, liquid_assets_cents INTEGER NOT NULL, first_time_buyer INTEGER NOT NULL, veteran INTEGER NOT NULL, customer_since TEXT NOT NULL, loan_officer_id INTEGER NOT NULL REFERENCES loan_officers(id));`,
  `CREATE TABLE properties (id INTEGER PRIMARY KEY, address TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, zip TEXT NOT NULL, property_type TEXT NOT NULL, year_built INTEGER NOT NULL, value_cents INTEGER NOT NULL, annual_tax_cents INTEGER NOT NULL, annual_insurance_cents INTEGER NOT NULL, monthly_hoa_cents INTEGER NOT NULL, flood_zone TEXT NOT NULL);`,
  `CREATE TABLE mortgages (id INTEGER PRIMARY KEY, borrower_id INTEGER NOT NULL REFERENCES borrowers(id), property_id INTEGER NOT NULL REFERENCES properties(id), loan_officer_id INTEGER NOT NULL REFERENCES loan_officers(id), program TEXT NOT NULL, lien_position INTEGER NOT NULL, rate_type TEXT NOT NULL, original_amount_cents INTEGER NOT NULL, note_rate REAL NOT NULL, term_months INTEGER NOT NULL, originated_on TEXT NOT NULL, balance_cents INTEGER NOT NULL, monthly_payment_cents INTEGER NOT NULL, status TEXT NOT NULL, closed_on TEXT);`,
  `CREATE TABLE payments (id INTEGER PRIMARY KEY, mortgage_id INTEGER NOT NULL REFERENCES mortgages(id), due_on TEXT NOT NULL, paid_on TEXT, amount_cents INTEGER NOT NULL, status TEXT NOT NULL);`,
  `CREATE TABLE loan_applications (id INTEGER PRIMARY KEY, borrower_id INTEGER NOT NULL REFERENCES borrowers(id), property_id INTEGER NOT NULL REFERENCES properties(id), loan_officer_id INTEGER NOT NULL REFERENCES loan_officers(id), program TEXT NOT NULL, purpose TEXT NOT NULL, occupancy TEXT NOT NULL, rate_type TEXT NOT NULL, amount_cents INTEGER NOT NULL, purchase_price_cents INTEGER, note_rate REAL NOT NULL, term_months INTEGER NOT NULL, submitted_at TEXT NOT NULL, status TEXT NOT NULL);`,
];

export const LOAN_BOOK = { officers: 8, borrowers: 240, applications: 36 } as const;

/** Who an application is for, as the sample is generated: the seed's own rule. Apps read it from the database
 *  (Loan review: parties.ts), never from here. */
export function applicationFacts(id: number) {
  return { id, borrower: id, property: id, officer: officerOf(id) };
}
const officerOf = (borrower: number) => ((borrower - 1) % LOAN_BOOK.officers) + 1;

type Value = string | number | null;

/* ---------- places ---------- */

interface Place {
  city: string;
  state: string;
  zip: string;
  /** Effective property tax, as a share of value a year. */
  tax: number;
  /** Homeowners insurance a year, in dollars, for a typical home. */
  insurance: number;
  /** A typical home's value, in dollars. */
  value: number;
}
const PLACES: Place[] = [
  { city: "Austin", state: "TX", zip: "78704", tax: 0.019, insurance: 3600, value: 520_000 },
  { city: "Denver", state: "CO", zip: "80211", tax: 0.0055, insurance: 2900, value: 610_000 },
  { city: "Charlotte", state: "NC", zip: "28205", tax: 0.0085, insurance: 1700, value: 410_000 },
  { city: "Phoenix", state: "AZ", zip: "85016", tax: 0.0062, insurance: 2100, value: 450_000 },
  { city: "Columbus", state: "OH", zip: "43214", tax: 0.016, insurance: 1400, value: 300_000 },
  { city: "Tampa", state: "FL", zip: "33606", tax: 0.0105, insurance: 5400, value: 440_000 },
  { city: "Sacramento", state: "CA", zip: "95818", tax: 0.011, insurance: 1900, value: 560_000 },
  { city: "Nashville", state: "TN", zip: "37206", tax: 0.0072, insurance: 1800, value: 470_000 },
  { city: "Atlanta", state: "GA", zip: "30306", tax: 0.0105, insurance: 2000, value: 420_000 },
  { city: "Seattle", state: "WA", zip: "98117", tax: 0.0092, insurance: 1600, value: 880_000 },
  { city: "Minneapolis", state: "MN", zip: "55408", tax: 0.0118, insurance: 1900, value: 340_000 },
  { city: "San Diego", state: "CA", zip: "92104", tax: 0.011, insurance: 2000, value: 980_000 },
  { city: "Raleigh", state: "NC", zip: "27608", tax: 0.0082, insurance: 1600, value: 470_000 },
  { city: "Boise", state: "ID", zip: "83702", tax: 0.0063, insurance: 1300, value: 480_000 },
  { city: "Wendell", state: "NC", zip: "27591", tax: 0.0081, insurance: 1500, value: 300_000 },
];
const at = (city: string) => PLACES.findIndex((p) => p.city === city);

const STREETS = [
  "Oak Hollow Dr",
  "Maple Ave",
  "Cedar Ridge Ln",
  "Willow Creek Ct",
  "Elm St",
  "Highland Ave",
  "Lakeview Dr",
  "Birch Ln",
  "Sycamore St",
  "Park Pl",
  "Magnolia Way",
  "Juniper Ct",
  "Aspen Trl",
  "Riverbend Rd",
];

/* ---------- money ---------- */

const cents = (dollars: number) => Math.round(dollars * 100);
const round = (dollars: number, to = 1000) => Math.round(dollars / to) * to;

/** A fully amortizing loan's monthly principal and interest, in cents. */
function monthlyPayment(amountCents: number, rateMilli: number, months: number) {
  const r = rateMilli / 100000 / 12;
  if (r === 0) return Math.round(amountCents / months);
  return Math.round((amountCents * r) / (1 - (1 + r) ** -months));
}
/** What is left of a loan after `paid` monthly payments, in cents. */
function balanceAfter(amountCents: number, rateMilli: number, months: number, paid: number) {
  const r = rateMilli / 100000 / 12;
  const pmt = monthlyPayment(amountCents, rateMilli, months);
  const grown = (1 + r) ** Math.min(paid, months);
  return Math.max(0, Math.round(amountCents * grown - (pmt * (grown - 1)) / r));
}

/** The book is as of November 2026: a loan originated in `month` of `year` has made this many payments. */
const AS_OF = { year: 2026, month: 11 };
const paymentsMade = (year: number, month: number) =>
  Math.max(0, (AS_OF.year - year) * 12 + (AS_OF.month - month) - 1);
const iso = (year: number, month: number, day = 1) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** What a 30-year fixed cost, in thousandths of a percent (7125 is 7.125%), in the year a loan was made (roughly PMMS's yearly averages). */
const RATE_IN: Record<number, number> = {
  2014: 4125,
  2015: 3875,
  2016: 3625,
  2017: 4000,
  2018: 4625,
  2019: 4000,
  2020: 3000,
  2021: 2875,
  2022: 5250,
  2023: 7000,
  2024: 6750,
  2025: 6625,
};
/** How much a home bought in that year has gained by November 2026. */
const GROWN_SINCE: Record<number, number> = {
  2014: 1.85,
  2015: 1.75,
  2016: 1.65,
  2017: 1.55,
  2018: 1.45,
  2019: 1.4,
  2020: 1.32,
  2021: 1.15,
  2022: 1.0,
  2023: 1.02,
  2024: 1.0,
  2025: 0.99,
};

/* ---------- people ---------- */

const OFFICERS: [name: string, branch: string][] = [
  ["Megan Holloway", "Austin, TX"],
  ["Derek Simmons", "Denver, CO"],
  ["Tasha Freeman", "Charlotte, NC"],
  ["Luis Ortega", "Phoenix, AZ"],
  ["Karen Whitfield", "Columbus, OH"],
  ["Brandon Cole", "Tampa, FL"],
  ["Jenna Morales", "Sacramento, CA"],
  ["Malik Robinson", "Atlanta, GA"],
];

const FIRST = [
  "James",
  "Mary",
  "Robert",
  "Patricia",
  "John",
  "Jennifer",
  "Michael",
  "Linda",
  "David",
  "Elizabeth",
  "William",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Karen",
  "Juan",
  "Mei",
  "Darnell",
  "Priya",
  "Omar",
  "Keisha",
];
const LAST = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Wilson",
  "Anderson",
  "Taylor",
  "Thomas",
  "Moore",
  "Jackson",
  "Chen",
  "Nguyen",
  "Patel",
  "Washington",
];
const JOBS: [employer: string, title: string, income: number][] = [
  ["Dell Technologies", "Software engineer", 148_000],
  ["HCA Healthcare", "Registered nurse", 92_000],
  ["Wells Fargo", "Operations analyst", 78_000],
  ["Self-employed", "General contractor", 115_000],
  ["Kroger", "Store manager", 74_000],
  ["County school district", "Teacher", 64_000],
  ["Lockheed Martin", "Systems engineer", 132_000],
  ["Deloitte", "Senior consultant", 125_000],
  ["Home Depot", "Logistics supervisor", 69_000],
  ["Kaiser Permanente", "Physician assistant", 138_000],
  ["State of the borrower", "Program manager", 88_000],
  ["UPS", "Delivery driver", 71_000],
];

/* ---------- the applications in the queue ---------- */

interface Existing {
  program: string;
  year: number;
  month: number;
  amount: number;
  rate: number;
  lien?: 1 | 2;
  /** A HELOC: its line, and how much of it is drawn. */
  drawn?: number;
  /** Payments paid late in the last year (oldest first: 1 is twelve months ago). */
  late?: number[];
}

interface Case {
  name: string;
  co?: string;
  job: [employer: string, title: string, years: number];
  income: number;
  fico: number;
  /** Monthly debts other than housing: cars, cards, student loans. */
  debts: number;
  assets: number;
  ftb?: boolean;
  vet?: boolean;
  city: string;
  street: string;
  type: string;
  built: number;
  hoa?: number;
  flood?: string;
  /** Insurance a year, when it differs from the place's usual. */
  insurance?: number;
  program: string;
  purpose: string;
  occupancy?: string;
  rateType?: string;
  /** Appraised value. */
  value: number;
  /** A purchase's price; its down payment share; the program's financed fee. */
  price?: number;
  down?: number;
  fee?: number;
  /** A refinance's or second lien's amount. */
  amount?: number;
  rate: number;
  term?: number;
  status: string;
  existing?: Existing[];
}

const C = (c: Case) => c;

const CASES: Case[] = [
  C({
    name: "Emily Carter",
    co: "James Carter",
    job: ["Dell Technologies", "Product manager", 6],
    income: 142_000,
    fico: 742,
    debts: 650,
    assets: 78_000,
    ftb: true,
    city: "Austin",
    street: "4417 Oak Hollow Dr",
    type: "Single-family",
    built: 2004,
    program: "Conventional",
    purpose: "Purchase",
    value: 490_000,
    price: 485_000,
    down: 0.1,
    rate: 7125,
    status: "pending",
  }),
  C({
    name: "Marcus Johnson",
    job: ["Delta Air Lines", "Aircraft mechanic", 4],
    income: 92_000,
    fico: 641,
    debts: 520,
    assets: 24_000,
    ftb: true,
    city: "Atlanta",
    street: "1182 Sycamore St",
    type: "Townhouse",
    built: 2011,
    hoa: 185,
    program: "FHA",
    purpose: "Purchase",
    value: 331_000,
    price: 329_000,
    down: 0.035,
    fee: 0.0175,
    rate: 6875,
    status: "pending",
  }),
  C({
    name: "Sofia Ramirez",
    job: ["Honeywell Aerospace", "Quality engineer", 3],
    income: 118_000,
    fico: 698,
    debts: 540,
    assets: 15_000,
    vet: true,
    city: "Phoenix",
    street: "3025 Juniper Ct",
    type: "Single-family",
    built: 1998,
    program: "VA",
    purpose: "Purchase",
    value: 468_000,
    price: 465_000,
    down: 0,
    fee: 0.0215,
    rate: 6750,
    status: "pending",
  }),
  C({
    name: "David Patel",
    co: "Priya Patel",
    job: ["Qualcomm", "Director of engineering", 9],
    income: 395_000,
    fico: 781,
    debts: 1_900,
    assets: 410_000,
    city: "San Diego",
    street: "2210 Highland Ave",
    type: "Single-family",
    built: 1952,
    program: "Jumbo",
    purpose: "Purchase",
    value: 1_460_000,
    price: 1_450_000,
    down: 0.2,
    rate: 7250,
    status: "pending",
  }),
  C({
    name: "Robert Nguyen",
    job: ["Amazon", "Senior software engineer", 7],
    income: 168_000,
    fico: 765,
    debts: 400,
    assets: 64_000,
    city: "Seattle",
    street: "8034 Birch Ln",
    type: "Single-family",
    built: 1941,
    program: "HELOC",
    purpose: "Home equity line",
    rateType: "Variable",
    value: 910_000,
    amount: 150_000,
    rate: 8250,
    term: 360,
    status: "pending",
    existing: [{ program: "Conventional", year: 2021, month: 4, amount: 560_000, rate: 2875 }],
  }),
  C({
    name: "Linda Thompson",
    job: ["Nationwide Insurance", "Claims adjuster", 12],
    income: 78_000,
    fico: 688,
    debts: 1_150,
    assets: 9_000,
    city: "Columbus",
    street: "561 Maple Ave",
    type: "Single-family",
    built: 1964,
    program: "Conventional",
    purpose: "Cash-out refinance",
    value: 315_000,
    amount: 252_000,
    rate: 7375,
    status: "pending",
    existing: [
      { program: "Conventional", year: 2019, month: 6, amount: 190_000, rate: 4250, late: [7] },
    ],
  }),
  C({
    name: "Kevin O'Brien",
    job: ["Lockheed Martin", "Systems engineer", 5],
    income: 134_000,
    fico: 724,
    debts: 720,
    assets: 41_000,
    city: "Denver",
    street: "3349 Aspen Trl",
    type: "Single-family",
    built: 1978,
    program: "Conventional",
    purpose: "Rate-and-term refinance",
    rateType: "7/6 ARM",
    value: 640_000,
    amount: 505_000,
    rate: 6625,
    status: "pending",
    existing: [{ program: "Conventional", year: 2023, month: 10, amount: 520_000, rate: 7875 }],
  }),
  C({
    name: "Aisha Williams",
    job: ["WakeMed", "Medical assistant", 3],
    income: 82_000,
    fico: 668,
    debts: 450,
    assets: 13_000,
    ftb: true,
    city: "Wendell",
    street: "715 Riverbend Rd",
    type: "Single-family",
    built: 2019,
    program: "USDA",
    purpose: "Purchase",
    value: 292_000,
    price: 289_000,
    down: 0,
    fee: 0.01,
    rate: 6875,
    status: "pending",
  }),
  C({
    name: "Michael Brooks",
    co: "Jennifer Brooks",
    job: ["HCA Healthcare", "Regional director", 11],
    income: 188_000,
    fico: 802,
    debts: 980,
    assets: 165_000,
    city: "Nashville",
    street: "1906 Magnolia Way",
    type: "Single-family",
    built: 2016,
    hoa: 65,
    program: "Conventional",
    purpose: "Purchase",
    value: 620_000,
    price: 615_000,
    down: 0.2,
    rate: 7000,
    status: "conditions",
    existing: [{ program: "Conventional", year: 2016, month: 8, amount: 248_000, rate: 3625 }],
  }),
  C({
    name: "Tyrone Davis",
    job: ["Tampa General Hospital", "Patient transporter", 2],
    income: 58_000,
    fico: 604,
    debts: 600,
    assets: 17_000,
    ftb: true,
    city: "Tampa",
    street: "400 Bayshore Blvd, Unit 1207",
    type: "Condominium",
    built: 1985,
    hoa: 410,
    flood: "AE",
    insurance: 2400,
    program: "FHA",
    purpose: "Purchase",
    value: 245_000,
    price: 245_000,
    down: 0.035,
    fee: 0.0175,
    rate: 6875,
    status: "pending",
  }),
  C({
    name: "Hannah Kim",
    job: ["Target Corporation", "UX researcher", 3],
    income: 79_000,
    fico: 731,
    debts: 310,
    assets: 18_000,
    ftb: true,
    city: "Minneapolis",
    street: "2800 Lyndale Ave S, Unit 304",
    type: "Condominium",
    built: 2008,
    hoa: 325,
    program: "Conventional",
    purpose: "Purchase",
    value: 276_000,
    price: 275_000,
    down: 0.03,
    rate: 7000,
    status: "pending",
  }),
  C({
    name: "Carlos Hernandez",
    co: "Maria Hernandez",
    job: ["Sacramento County", "Civil engineer", 14],
    income: 152_000,
    fico: 715,
    debts: 620,
    assets: 22_000,
    city: "Sacramento",
    street: "2617 Willow Creek Ct",
    type: "Single-family",
    built: 1956,
    program: "Home equity",
    purpose: "Home equity loan",
    value: 585_000,
    amount: 95_000,
    rate: 8375,
    term: 180,
    status: "pending",
    existing: [{ program: "Conventional", year: 2020, month: 9, amount: 420_000, rate: 3000 }],
  }),
  C({
    name: "Jason Miller",
    job: ["Self-employed", "Real estate investor", 8],
    income: 165_000,
    fico: 758,
    debts: 900,
    assets: 160_000,
    city: "Boise",
    street: "1420 N 13th St",
    type: "2-unit",
    built: 1962,
    program: "Conventional",
    purpose: "Purchase",
    occupancy: "Investment",
    value: 525_000,
    price: 520_000,
    down: 0.25,
    rate: 7750,
    status: "pending",
    existing: [{ program: "Conventional", year: 2018, month: 3, amount: 312_000, rate: 4625 }],
  }),
  C({
    name: "Ashley Wilson",
    job: ["Whole Foods Market", "Category buyer", 2],
    income: 118_000,
    fico: 662,
    debts: 890,
    assets: 34_000,
    ftb: true,
    city: "Austin",
    street: "9512 Cedar Ridge Ln",
    type: "Single-family",
    built: 2001,
    program: "Conventional",
    purpose: "Purchase",
    value: 389_000,
    price: 399_000,
    down: 0.05,
    rate: 7250,
    status: "pending",
  }),
  C({
    name: "Brian Scott",
    job: ["Ball Aerospace", "Machinist", 10],
    income: 141_000,
    fico: 709,
    debts: 780,
    assets: 31_000,
    city: "Denver",
    street: "4105 Lakeview Dr",
    type: "Single-family",
    built: 1972,
    program: "HELOC",
    purpose: "Home equity line",
    rateType: "Variable",
    value: 720_000,
    amount: 200_000,
    rate: 8500,
    term: 360,
    status: "pending",
    existing: [{ program: "Conventional", year: 2020, month: 7, amount: 480_000, rate: 2750 }],
  }),
  C({
    name: "Nicole Adams",
    job: ["Emory Healthcare", "Billing specialist", 6],
    income: 88_000,
    fico: 676,
    debts: 690,
    assets: 12_000,
    city: "Atlanta",
    street: "2280 Elm St",
    type: "Single-family",
    built: 1958,
    program: "Conventional",
    purpose: "Cash-out refinance",
    value: 410_000,
    amount: 328_000,
    rate: 7375,
    status: "pending",
    existing: [
      { program: "Conventional", year: 2017, month: 5, amount: 280_000, rate: 4000, late: [4, 9] },
    ],
  }),
  C({
    name: "Daniel Lee",
    job: ["Microsoft", "Principal program manager", 8],
    income: 312_000,
    fico: 744,
    debts: 1_650,
    assets: 260_000,
    city: "Seattle",
    street: "6611 Park Pl",
    type: "Single-family",
    built: 2014,
    program: "Jumbo",
    purpose: "Purchase",
    value: 1_185_000,
    price: 1_185_000,
    down: 0.15,
    rate: 7375,
    status: "pending",
  }),
  C({
    name: "Stephanie Clark",
    job: ["JPMorgan Chase", "Risk analyst", 7],
    income: 92_000,
    fico: 790,
    debts: 0,
    assets: 98_000,
    ftb: true,
    city: "Columbus",
    street: "88 Highland Ave",
    type: "Single-family",
    built: 1948,
    program: "Conventional",
    purpose: "Purchase",
    value: 268_000,
    price: 265_000,
    down: 0.2,
    rate: 7000,
    status: "approved",
  }),
  C({
    name: "Anthony Martinez",
    job: ["Banner Health", "Respiratory therapist", 5],
    income: 96_000,
    fico: 684,
    debts: 610,
    assets: 13_000,
    vet: true,
    city: "Phoenix",
    street: "5120 Sycamore St",
    type: "Single-family",
    built: 2006,
    program: "VA",
    purpose: "Rate-and-term refinance",
    value: 445_000,
    amount: 398_000,
    rate: 6500,
    status: "pending",
    existing: [{ program: "VA", year: 2023, month: 11, amount: 410_000, rate: 7500 }],
  }),
  C({
    name: "Rachel Green",
    job: ["Bank of America", "Vice president, treasury", 13],
    income: 158_000,
    fico: 778,
    debts: 350,
    assets: 72_000,
    city: "Charlotte",
    street: "1732 Oak Hollow Dr",
    type: "Single-family",
    built: 1936,
    program: "HELOC",
    purpose: "Home equity line",
    rateType: "Variable",
    value: 455_000,
    amount: 120_000,
    rate: 8000,
    term: 360,
    status: "approved",
    existing: [{ program: "Conventional", year: 2016, month: 4, amount: 300_000, rate: 3750 }],
  }),
  C({
    name: "Christopher Hall",
    job: ["Raymond James", "Financial advisor", 4],
    income: 148_000,
    fico: 702,
    debts: 700,
    assets: 82_000,
    city: "Tampa",
    street: "3407 Magnolia Way",
    type: "Single-family",
    built: 1999,
    insurance: 6800,
    program: "Conventional",
    purpose: "Purchase",
    value: 540_000,
    price: 535_000,
    down: 0.1,
    rate: 7250,
    status: "pending",
  }),
  C({
    name: "Megan Young",
    job: ["Vanderbilt University Medical Center", "Pharmacy technician", 1],
    income: 69_000,
    fico: 582,
    debts: 700,
    assets: 14_000,
    ftb: true,
    city: "Nashville",
    street: "1018 Juniper Ct",
    type: "Single-family",
    built: 1994,
    program: "FHA",
    purpose: "Purchase",
    value: 352_000,
    price: 349_000,
    down: 0.035,
    fee: 0.0175,
    rate: 6875,
    status: "suspended",
  }),
  C({
    name: "Joshua King",
    co: "Lauren King",
    job: ["SAS Institute", "Data scientist", 6],
    income: 176_000,
    fico: 768,
    debts: 820,
    assets: 135_000,
    city: "Raleigh",
    street: "5502 Willow Creek Ct",
    type: "Single-family",
    built: 2010,
    hoa: 45,
    program: "Conventional",
    purpose: "Purchase",
    value: 565_000,
    price: 560_000,
    down: 0.2,
    rate: 7000,
    status: "pending",
  }),
  C({
    name: "Samantha Wright",
    job: ["Intel", "Hardware engineer", 4],
    income: 138_000,
    fico: 735,
    debts: 900,
    assets: 92_000,
    city: "Sacramento",
    street: "4720 Elm St",
    type: "Single-family",
    built: 1988,
    program: "Conventional",
    purpose: "Purchase",
    value: 625_000,
    price: 620_000,
    down: 0.1,
    rate: 7125,
    status: "pending",
  }),
  C({
    name: "Andrew Lopez",
    job: ["Vail Resorts", "Finance manager", 5],
    income: 122_000,
    fico: 750,
    debts: 560,
    assets: 46_000,
    city: "Denver",
    street: "2988 Birch Ln",
    type: "Single-family",
    built: 2003,
    program: "Conventional",
    purpose: "Rate-and-term refinance",
    value: 575_000,
    amount: 455_000,
    rate: 6875,
    status: "pending",
    existing: [{ program: "Conventional", year: 2024, month: 5, amount: 466_000, rate: 7250 }],
  }),
  C({
    name: "Olivia Hill",
    job: ["Best Buy", "Merchandising manager", 7],
    income: 94_000,
    fico: 694,
    debts: 480,
    assets: 16_000,
    city: "Minneapolis",
    street: "3911 Lakeview Dr",
    type: "Single-family",
    built: 1925,
    program: "HELOC",
    purpose: "Home equity line",
    rateType: "Variable",
    value: 380_000,
    amount: 60_000,
    rate: 8750,
    term: 360,
    status: "pending",
    existing: [{ program: "Conventional", year: 2021, month: 2, amount: 300_000, rate: 2990 }],
  }),
  C({
    name: "Ryan Allen",
    job: ["US Army Reserve; Tesla", "Production supervisor", 3],
    income: 132_000,
    fico: 655,
    debts: 900,
    assets: 19_000,
    vet: true,
    city: "Austin",
    street: "11804 Riverbend Rd",
    type: "Single-family",
    built: 2018,
    hoa: 50,
    program: "VA",
    purpose: "Purchase",
    value: 548_000,
    price: 545_000,
    down: 0,
    fee: 0.0215,
    rate: 6750,
    status: "pending",
  }),
  C({
    name: "Grace Turner",
    job: ["Cox Enterprises", "Chief marketing officer", 9],
    income: 210_000,
    fico: 771,
    debts: 3_100,
    assets: 190_000,
    city: "Tampa",
    street: "500 Harbour Island Blvd, Unit 902",
    type: "Condominium",
    built: 2002,
    hoa: 690,
    flood: "AE",
    insurance: 3100,
    program: "Conventional",
    purpose: "Purchase",
    occupancy: "Second home",
    value: 380_000,
    price: 380_000,
    down: 0.1,
    rate: 7375,
    status: "pending",
  }),
  C({
    name: "Ethan Baker",
    co: "Chloe Baker",
    job: ["Honda of America", "Line supervisor", 8],
    income: 98_000,
    fico: 690,
    debts: 520,
    assets: 15_000,
    ftb: true,
    city: "Columbus",
    street: "7740 Riverbend Rd, Sunbury",
    type: "Single-family",
    built: 2021,
    program: "USDA",
    purpose: "Purchase",
    value: 318_000,
    price: 315_000,
    down: 0,
    fee: 0.01,
    rate: 6875,
    status: "conditions",
  }),
  C({
    name: "Patricia Gonzalez",
    job: ["Sharp HealthCare", "Anesthesiologist", 16],
    income: 420_000,
    fico: 798,
    debts: 1_100,
    assets: 520_000,
    city: "San Diego",
    street: "4455 Park Pl",
    type: "Single-family",
    built: 1931,
    program: "HELOC",
    purpose: "Home equity line",
    rateType: "Variable",
    value: 1_250_000,
    amount: 250_000,
    rate: 7750,
    term: 360,
    status: "pending",
    existing: [{ program: "Jumbo", year: 2021, month: 6, amount: 720_000, rate: 2875 }],
  }),
  C({
    name: "Kenneth Moore",
    job: ["Duke Energy", "Line technician", 11],
    income: 92_000,
    fico: 655,
    debts: 1_050,
    assets: 8_000,
    city: "Charlotte",
    street: "2203 Maple Ave",
    type: "Single-family",
    built: 1971,
    program: "Conventional",
    purpose: "Cash-out refinance",
    value: 390_000,
    amount: 312_000,
    rate: 7500,
    status: "pending",
    existing: [
      { program: "Conventional", year: 2022, month: 3, amount: 255_000, rate: 5250 },
      {
        program: "HELOC",
        year: 2024,
        month: 2,
        amount: 50_000,
        drawn: 20_000,
        rate: 8750,
        lien: 2,
        late: [11],
      },
    ],
  }),
  C({
    name: "Jessica Campbell",
    job: ["Expedia Group", "Engineering manager", 5],
    income: 224_000,
    fico: 757,
    debts: 1_050,
    assets: 185_000,
    city: "Seattle",
    street: "7215 Aspen Trl",
    type: "Single-family",
    built: 1996,
    program: "Conventional",
    purpose: "Purchase",
    value: 800_000,
    price: 795_000,
    down: 0.2,
    rate: 7125,
    status: "pending",
  }),
  C({
    name: "William Parker",
    job: ["Retired (Honeywell pension)", "Retired", 0],
    income: 92_000,
    fico: 721,
    debts: 420,
    assets: 210_000,
    city: "Phoenix",
    street: "6702 Cedar Ridge Ln",
    type: "Single-family",
    built: 1989,
    program: "Home equity",
    purpose: "Home equity loan",
    value: 498_000,
    amount: 75_000,
    rate: 8250,
    term: 240,
    status: "approved",
    existing: [{ program: "Conventional", year: 2018, month: 9, amount: 330_000, rate: 4500 }],
  }),
  C({
    name: "Natalie Evans",
    job: ["Asurion", "Customer success lead", 3],
    income: 78_000,
    fico: 709,
    debts: 380,
    assets: 21_000,
    ftb: true,
    city: "Nashville",
    street: "1544 Elm St",
    type: "Townhouse",
    built: 2017,
    hoa: 140,
    program: "Conventional",
    purpose: "Purchase",
    value: 300_000,
    price: 299_000,
    down: 0.03,
    rate: 7000,
    status: "pending",
  }),
  C({
    name: "Steven Collins",
    co: "Amy Collins",
    job: ["Red Hat", "Site reliability engineer", 6],
    income: 146_000,
    fico: 726,
    debts: 640,
    assets: 38_000,
    city: "Raleigh",
    street: "3314 Sycamore St",
    type: "Single-family",
    built: 2005,
    hoa: 40,
    program: "Conventional",
    purpose: "Rate-and-term refinance",
    value: 495_000,
    amount: 371_000,
    rate: 6875,
    status: "pending",
    existing: [{ program: "FHA", year: 2023, month: 6, amount: 380_000, rate: 7000 }],
  }),
  C({
    name: "Victoria Reed",
    job: ["Palantir", "Deployment strategist", 4],
    income: 265_000,
    fico: 735,
    debts: 1_400,
    assets: 290_000,
    city: "Denver",
    street: "2050 Highland Ave",
    type: "Single-family",
    built: 2012,
    program: "Jumbo",
    purpose: "Purchase",
    value: 1_050_000,
    price: 1_050_000,
    down: 0.2,
    rate: 7250,
    status: "pending",
  }),
];

/* ---------- the book ---------- */

export function loanBook(insert: (table: string, rows: Value[][]) => void) {
  insert(
    "loan_officers",
    OFFICERS.map(([name, branch], i) => [
      i + 1,
      name,
      String(1_402_337 + i * 48_611),
      branch,
      `(${["512", "303", "704", "602", "614", "813", "916", "404"][i]}) 555-01${String(20 + i * 7).padStart(2, "0")}`,
      `${name.split(" ")[0]!.toLowerCase()}.${name.split(" ")[1]!.toLowerCase()}@homestead-lending.example`,
    ]),
  );

  const borrowers: Value[][] = [];
  const properties: Value[][] = [];
  const mortgages: Value[][] = [];
  const payments: Value[][] = [];
  const applications: Value[][] = [];

  /** A property row; its tax and insurance follow its place unless the case says otherwise. */
  const property = (
    id: number,
    p: Place,
    street: string,
    type: string,
    built: number,
    value: number,
    hoa = 0,
    flood = "X",
    insurance?: number,
  ) =>
    properties.push([
      id,
      street,
      p.city,
      p.state,
      p.zip,
      type,
      built,
      cents(value),
      cents(round(value * p.tax, 10)),
      cents(insurance ?? round(p.insurance * Math.sqrt(value / p.value), 10)),
      cents(hoa),
      flood,
    ]);

  /** A mortgage and its last twelve months of payments (or none, once it is closed). */
  const mortgage = (
    borrower: number,
    prop: number,
    e: Existing,
    status: string,
    closedOn: string | null = null,
  ) => {
    const id = mortgages.length + 1;
    const lien = e.lien ?? (e.program === "HELOC" ? 2 : 1);
    const heloc = e.program === "HELOC";
    const term = 360;
    const original = cents(e.amount);
    const balance = closedOn
      ? 0
      : heloc
        ? cents(e.drawn ?? e.amount * 0.5)
        : balanceAfter(original, e.rate, term, paymentsMade(e.year, e.month));
    // A HELOC's draw period is interest-only, on what is drawn.
    const pmt = heloc
      ? Math.round((cents(e.drawn ?? e.amount * 0.5) * e.rate) / 100000 / 12)
      : monthlyPayment(original, e.rate, term);
    mortgages.push([
      id,
      borrower,
      prop,
      officerOf(borrower),
      e.program,
      lien,
      heloc ? "Variable" : "Fixed",
      original,
      e.rate / 1000,
      term,
      iso(e.year, e.month, 1 + (borrower % 27)),
      balance,
      pmt,
      status,
      closedOn,
    ]);
    if (closedOn) return;
    const late = new Set(e.late ?? []);
    const missedFrom = status === "delinquent" ? 12 : 99;
    for (let k = 1; k <= 12; k++) {
      // Twelve due dates, December 2025 to November 2026.
      const year = k === 1 ? 2025 : 2026;
      const month = k === 1 ? 12 : k - 1;
      const missed = k >= missedFrom;
      const isLate = !missed && late.has(k);
      payments.push([
        payments.length + 1,
        id,
        iso(year, month, 1),
        missed ? null : iso(year, month, isLate ? 18 + (k % 9) : 1 + ((borrower + k) % 9)),
        pmt,
        missed ? "missed" : isLate ? "late" : "on time",
      ]);
    }
  };

  // The applicants: borrowers, properties and applications 1–36, one each.
  CASES.forEach((c, i) => {
    const id = i + 1;
    const place = PLACES[at(c.city)]!;
    property(id, place, c.street, c.type, c.built, c.value, c.hoa, c.flood, c.insurance);
    const since = c.existing?.length
      ? iso(Math.min(...c.existing.map((e) => e.year)), c.existing[0]!.month, 1 + (id % 27))
      : `2026-${String(9 + (id % 2)).padStart(2, "0")}-${String(3 + (id % 25)).padStart(2, "0")}`;
    borrowers.push([
      id,
      c.name,
      c.co ?? null,
      c.job[0],
      c.job[1],
      c.job[2],
      cents(c.income),
      c.fico,
      cents(c.debts),
      cents(c.assets),
      c.ftb ? 1 : 0,
      c.vet ? 1 : 0,
      since,
      officerOf(id),
    ]);
    // A purchase moves the borrower; an earlier home's loan was on another property, so it is on file, paid off
    // or still open, but on the home being bought there is nothing yet.
    const buying = c.purpose === "Purchase";
    for (const e of c.existing ?? []) {
      if (buying) {
        const prev = 300 + id;
        property(
          prev,
          place,
          `${100 + id * 13} ${STREETS[id % STREETS.length]}`,
          "Single-family",
          1990 + (id % 25),
          round(e.amount * 1.6),
        );
        mortgage(id, prev, e, "current");
      } else mortgage(id, id, e, "current");
    }
    const amount = c.price
      ? round(c.price * (1 - (c.down ?? 0)) * (1 + (c.fee ?? 0)), 1)
      : (c.amount ?? 0);
    applications.push([
      id,
      id,
      id,
      officerOf(id),
      c.program,
      c.purpose,
      c.occupancy ?? "Primary residence",
      c.rateType ?? "Fixed",
      cents(amount),
      c.price ? cents(c.price) : null,
      c.rate / 1000,
      c.term ?? 360,
      `2026-11-${String(2 + (i % 19)).padStart(2, "0")}T${String(9 + (i % 8)).padStart(2, "0")}:${String((i * 17) % 60).padStart(2, "0")}:00Z`,
      c.status,
    ]);
  });

  // The rest of the book: homeowners with loans on file, for the officers' books and the properties' liens.
  for (let b = CASES.length + 1; b <= LOAN_BOOK.borrowers; b++) {
    const place = PLACES[b % (PLACES.length - 1)]!;
    const year = 2014 + (b % 12);
    const month = 1 + ((b * 5) % 12);
    const value = round(place.value * (0.72 + ((b * 37) % 60) / 100));
    const [employer, title, income] = JOBS[b % JOBS.length]!;
    const fico = 640 + ((b * 53) % 170);
    const program =
      b % 13 === 0 ? "VA" : b % 5 === 0 ? "FHA" : value > 850_000 ? "Jumbo" : "Conventional";
    const original = round(
      (value / GROWN_SINCE[year]!) * (program === "Conventional" ? 0.8 : 0.95),
    );
    property(
      b,
      place,
      `${100 + ((b * 131) % 9800)} ${STREETS[b % STREETS.length]}`,
      b % 9 === 0 ? "Condominium" : b % 11 === 0 ? "Townhouse" : "Single-family",
      1950 + ((b * 7) % 74),
      value,
      b % 9 === 0 ? 280 + (b % 5) * 40 : 0,
      place.state === "FL" && b % 3 === 0 ? "AE" : "X",
    );
    borrowers.push([
      b,
      `${FIRST[b % FIRST.length]} ${LAST[(b * 7) % LAST.length]}`,
      b % 3 === 0 ? `${FIRST[(b + 5) % FIRST.length]} ${LAST[(b * 7) % LAST.length]}` : null,
      employer,
      title,
      1 + (b % 15),
      cents(round(income * (0.85 + (b % 7) / 10), 500)),
      fico,
      cents(200 + ((b * 97) % 1400)),
      cents(round(8_000 + ((b * 7919) % 120_000), 100)),
      0,
      program === "VA" ? 1 : 0,
      iso(year - (b % 4 === 0 ? 5 : 0), month, 1 + (b % 27)),
      officerOf(b),
    ]);
    // Some refinanced into the low rates of 2020–21: the loan they left is on file, closed.
    if ((year === 2020 || year === 2021) && b % 3 === 0)
      mortgage(
        b,
        b,
        {
          program,
          year: year - 5,
          month,
          amount: round(original * 0.85),
          rate: RATE_IN[year - 5] ?? 4000,
        },
        "refinanced",
        iso(year, month, 1 + (b % 27)),
      );
    const paidOff = b % 29 === 0;
    const delinquent = !paidOff && b % 23 === 0;
    const late = (b + 3) % 17 === 0 ? [5 + (b % 6)] : delinquent ? [9, 10] : [];
    mortgage(
      b,
      b,
      { program, year, month, amount: original, rate: RATE_IN[year]! + ((b % 3) - 1) * 125, late },
      paidOff ? "paid off" : delinquent ? "delinquent" : "current",
      paidOff ? iso(2026, 1 + (b % 9), 15) : null,
    );
    if (b % 7 === 0 && !paidOff)
      mortgage(
        b,
        b,
        {
          program: "HELOC",
          year: 2023 + (b % 3),
          month: 1 + (b % 12),
          amount: round(value * 0.1, 5000),
          drawn: round(value * 0.06, 500),
          rate: 8250 + (b % 4) * 125,
          lien: 2,
        },
        "current",
      );
  }

  insert("borrowers", borrowers);
  insert("properties", properties);
  insert("mortgages", mortgages);
  insert("payments", payments);
  insert("loan_applications", applications);
}
