/**
 * The engine tests' instance, owned by the package: a data browser's kinds and layouts with a loan-review page beside
 * them, so one store covers the free layout, a curated page and moving between them. Plain kinds (no React), in the
 * shapes the example apps use (examples/data-studio, examples/loan-review): the same kind names, size hints, params,
 * preset ids and page views, so a test reads like the app it stands for. The examples are free to change: these tests
 * don't move with them, and the apps' own suites test the apps.
 */
import { column, optional, appOnly, pane, row, type ObjectRef, type ParamValue } from "@jali/core";
import {
  browserStorage,
  chooserFeature,
  createJaliStore,
  createPaneKinds,
  definePageEngine,
  paletteFeature,
  settingsFeature,
  toLayout,
  type JaliConfig,
  type JaliStore,
} from "@jali/core/adapter";

type Kind = Parameters<ReturnType<typeof createPaneKinds>["register"]>[0];

const singular = (table: string) =>
  table === "addresses" ? "address" : table === "categories" ? "category" : table.replace(/s$/, "");
const rowKey = (v: ParamValue): string | number => (typeof v === "number" ? v : String(v));
const recordParams = { table: String, id: rowKey };

// ---------- the data browser (Data Studio's shapes) ----------
const browser: Kind[] = [
  { kind: "catalog", title: "Tables", width: { min: 240, max: 320 }, height: { min: 200 } },
  {
    kind: "table",
    params: { table: String },
    title: ({ table }) => String(table),
    width: { min: 440, comfortable: 560 },
    height: { min: 240 },
    holdWhileResizing: true,
  },
  {
    kind: "record",
    params: recordParams,
    title: ({ table, id }) => `${singular(String(table))} ${id}`,
    width: { min: 360, comfortable: 440, max: 600 },
    height: { min: 240 },
  },
  {
    kind: "related",
    title: ({ label }) => String(label ?? "Related"),
    width: { min: 360, comfortable: 480 },
    height: { min: 240 },
  },
  {
    kind: "query",
    params: { sql: optional(String), autorun: appOnly(Boolean) },
    title: "Query",
    width: { min: 400, comfortable: 560 },
    height: { min: 280 },
    scratch: true,
    inRecent: true,
    holdWhileResizing: true,
  },
  {
    kind: "chart",
    params: { runId: optional(String, { link: false }) },
    title: "Chart",
    width: { min: 360, comfortable: 480 },
    height: { min: 220 },
    inRecent: ({ runId }) => !!runId,
  },
  {
    kind: "structure",
    params: { table: String },
    title: ({ table }) => `${table} structure`,
    width: { min: 380, comfortable: 440, max: 720 },
    height: { min: 240 },
  },
  {
    kind: "er",
    params: { table: String },
    title: ({ table }) => `${table} relations`,
    width: { min: 400, comfortable: 560 },
    height: { min: 240 },
  },
  {
    kind: "audit",
    title: "Audit log",
    width: { min: 360, comfortable: 480 },
    height: { min: 240 },
  },
];
const launcher: Kind = {
  kind: "launcher",
  title: "New pane",
  width: { min: 320 },
  height: { min: 200 },
  scratch: true,
};

const table = (name: string): ObjectRef => ({ kind: "table", params: { table: name } });
const record = (name: string, id: number): ObjectRef => ({
  kind: "record",
  params: { table: name, id },
});
const related = (params: Record<string, string | number>): ObjectRef => ({
  kind: "related",
  params,
});
const of = (kind: string, params: Record<string, string | number | boolean> = {}): ObjectRef => ({
  kind,
  params,
});

/** The bar's layouts; ids are spelled out, as links and saved layouts name panes by id. */
const presets = [
  {
    id: "one-table",
    label: "One table",
    layout: () =>
      row(
        { id: "r" },
        pane(of("catalog"), { id: "catalog", px: 280 }),
        pane(table("orders"), { id: "orders", linkedTo: "catalog" }),
      ),
  },
  {
    id: "order-chain",
    label: "Order → customer chain",
    layout: () =>
      row(
        { id: "r" },
        pane(table("orders"), { id: "orders", weight: 1.4 }),
        pane(record("orders", 1), { id: "order", linkedTo: "orders", follows: true }),
        pane(record("customers", 1), { id: "customer", linkedTo: "order" }),
      ),
  },
  {
    id: "query-chart",
    label: "Query + chart + inspector",
    layout: () =>
      row(
        { id: "r" },
        column(
          { id: "c", weight: 1.6 },
          pane(
            of("query", {
              sql: "SELECT status, count(*) FROM orders GROUP BY status",
              autorun: true,
            }),
            {
              id: "query",
            },
          ),
          pane(of("chart", { runId: "" }), { id: "chart", linkedTo: "query" }),
        ),
        pane(of("structure", { table: "sample_orders" }), { id: "inspector" }),
      ),
  },
  {
    id: "stress-10",
    label: "Stress: 10 panes",
    layout: () =>
      row(
        { id: "r" },
        pane(table("orders"), { id: "s1" }),
        pane(record("orders", 1), { id: "s2", linkedTo: "s1", follows: true }),
        pane(record("customers", 1), { id: "s3", linkedTo: "s2" }),
        column(
          { id: "c1" },
          pane(
            related({
              table: "orders",
              column: "customer_id",
              value: 1,
              label: "Orders by this customer",
            }),
            { id: "s4", linkedTo: "s3" },
          ),
          pane(record("products", 1), { id: "s5" }),
        ),
        pane(record("suppliers", 1), { id: "s6", linkedTo: "s5" }),
        column(
          { id: "c2" },
          pane(
            related({
              table: "reviews",
              column: "product_id",
              value: 1,
              label: "Reviews of this product",
            }),
            { id: "s7" },
          ),
          pane(of("audit"), { id: "s8" }),
        ),
        pane(of("structure", { table: "orders" }), { id: "s9" }),
        pane(of("er", { table: "orders" }), { id: "s10" }),
      ),
  },
];

// ---------- the loan-review page (Loan review's shapes) ----------
const NOUN: Record<string, string> = {
  loan_applications: "Application",
  members: "Member",
  lending_groups: "Group",
  field_officers: "Field officer",
  loans: "Loan",
  repayments: "Instalment",
};
const review: Kind[] = [
  {
    kind: "review-overview",
    params: { item: Number },
    title: ({ item }) => `Application #${item} overview`,
    width: { min: 360 },
    height: { min: 240 },
    inRecent: false,
  },
  {
    kind: "review-record",
    params: recordParams,
    title: ({ table, id }) => `${NOUN[String(table)] ?? singular(String(table))} #${id}`,
    width: { min: 380 },
    height: { min: 240 },
    shows: "record",
  },
  {
    kind: "review-related",
    title: ({ label }) => String(label ?? "Related"),
    width: { min: 360 },
    height: { min: 240 },
    shows: "related",
  },
];

/** Who an application is for: the sample data's rule (300 members in 24 groups, 6 field officers). */
export function applicationFacts(id: number) {
  const member = ((id * 37) % 300) + 1;
  const group = ((member - 1) % 24) + 1;
  return { id, member, group, officer: ((group - 1) % 6) + 1 };
}

const ROLES = [
  { id: "overview", label: "Overview", priority: "supporting" as const },
  { id: "application", label: "Application", priority: "primary" as const },
  { id: "borrower", label: "Borrower", priority: "supporting" as const },
  { id: "history", label: "Loan history", priority: "supporting" as const },
  { id: "group", label: "Group", priority: "supporting" as const },
  { id: "officer", label: "Field officer", priority: "supporting" as const },
];

const reviewRecord = (name: string, id: number): ObjectRef => ({
  kind: "review-record",
  params: { table: name, id },
});

function bind(item: number): Record<string, ObjectRef> {
  const f = applicationFacts(item);
  return {
    overview: of("review-overview", { item: f.id }),
    application: reviewRecord("loan_applications", f.id),
    borrower: reviewRecord("members", f.member),
    history: {
      kind: "review-related",
      params: { table: "loans", column: "member_id", value: f.member, label: "Loan history" },
    },
    group: reviewRecord("lending_groups", f.group),
    officer: reviewRecord("field_officers", f.officer),
  };
}

function build(item: number) {
  const refs = bind(item);
  const view = (id: string, options: { weight?: number; hidden?: boolean } = {}) =>
    pane(refs[id]!, {
      id,
      role: id,
      priority: ROLES.find((r) => r.id === id)!.priority,
      ...options,
    });
  return row(
    { id: "arrangement" },
    view("overview", { hidden: true }),
    view("application", { weight: 1.15 }),
    column({ id: "context" }, view("borrower"), view("history")),
    column(
      { id: "network", weight: 0.85 },
      view("group", { hidden: true }),
      view("officer", { hidden: true }),
    ),
  );
}

const loanReview = definePageEngine({
  id: "loan-review",
  name: "Loan review",
  itemNoun: "application",
  viewers: { full: "credit reviewer", limited: "loan officer" },
  roles: ROLES,
  home: "overview",
  build,
  bind,
  firstItem: 1,
});

export const testKinds = () =>
  createPaneKinds([...browser, ...review, { ...launcher, transient: true }]);

/**
 * The store before it boots, with nothing outside it (no address, no DOM focus unless given). `deps` adds or
 * overrides the rest (tests pass `initial`, `url`, ...). It has Jali's dialogs, as an app with `defaultFeatures()`
 * does, without the address (a store made by hand has none) and without parts to draw them: no test of it renders.
 */
export function createTestStore(deps: Partial<JaliConfig> = {}): JaliStore {
  return createJaliStore({
    kinds: testKinds(),
    launcher: launcher.kind,
    profile: loanReview,
    presets: presets.map((p) => ({ id: p.id, label: p.label, build: () => toLayout(p.layout()) })),
    preset: "order-chain",
    name: "Data Studio",
    storage: browserStorage("jali-tests"),
    features: [paletteFeature(), settingsFeature(), chooserFeature()],
    ...deps,
  });
}
