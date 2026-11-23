/** A property: where it is, what it is worth and costs to hold, and every lien recorded on it. */
import { useCount, useLiensOn } from "../../data";
import type { Property } from "../../model/rows";
import { AS_OF_YEAR, bookOf, inFloodZone, type Book } from "../../model/underwriting";
import { cityLine, pct, usd } from "../../model/words";
import { applicationsOn, liensOn } from "../../nav/refs";
import { mortgageCols as cols } from "../columns/mortgages";
import {
  Columns,
  Facts,
  Pending,
  Section,
  Table,
  View,
  ViewHead,
  type Fact,
} from "../parts/layout";
import { CountLink, RelatedList } from "../parts/links";

export function PropertyView({ row: p }: { row: Property }) {
  const liens = useLiensOn(p.id);
  const apps = useCount("loan_applications", { property_id: p.id });
  return (
    <View label="Property">
      <ViewHead kicker={`Property · ${p.property_type}`} title={p.address}>
        {cityLine(p)}
      </ViewHead>
      <Columns
        main={
          <>
            <Section title="Property">
              <Facts rows={about(p)} />
            </Section>
            <Section title="Value and equity">
              <Facts rows={value(p, liens && bookOf(liens))} />
            </Section>
            <Section title="Cost to hold">
              <Facts rows={costToHold(p)} />
            </Section>
            <Section title="Liens recorded">
              {liens ? (
                liens.length ? (
                  <Table
                    label="Mortgages on this property"
                    rows={liens}
                    cols={[cols.loan, cols.program, cols.rate, cols.balance, cols.status]}
                  />
                ) : (
                  <p className="rv-muted">No liens with us: a purchase, or owned free and clear.</p>
                )
              ) : (
                <Pending />
              )}
            </Section>
          </>
        }
        side={
          <Section title="On file">
            <RelatedList>
              <CountLink to={liensOn(p.id, p.address)} count={liens?.length} noun="lien" />
              <CountLink to={applicationsOn(p.id, p.address)} count={apps} noun="application" />
            </RelatedList>
          </Section>
        }
      />
    </View>
  );
}

/** What the home is: its type, its age, its flood zone. */
const about = (p: Property): Fact[] => [
  ["Type", p.property_type],
  ["Built", String(p.year_built), `${AS_OF_YEAR - p.year_built} years old`],
  [
    "Flood zone",
    `Zone ${p.flood_zone}`,
    inFloodZone(p) ? (
      <span className="rv-warn">Special flood hazard area: insurance required</span>
    ) : (
      "Minimal flood risk"
    ),
  ],
];

/** What it is worth, what is owed on it (`liens`, summed up; undefined while they load), and the equity left. */
function value(p: Property, liens: Book | undefined): Fact[] {
  const equity = liens && p.value_cents - liens.balance;
  return [
    ["Value", usd(p.value_cents), "appraisal or AVM"],
    [
      "Liens",
      liens ? (liens.open ? usd(liens.balance) : "None") : "…",
      liens?.open ? `${liens.open} open` : undefined,
    ],
    [
      "Equity",
      equity === undefined ? "…" : usd(equity),
      equity === undefined ? undefined : pct(equity / p.value_cents),
    ],
  ];
}

/** What it costs a year or a month to hold: tax, insurance, HOA dues. */
const costToHold = (p: Property): Fact[] => [
  ["Property tax", `${usd(p.annual_tax_cents)} a year`, pct(p.annual_tax_cents / p.value_cents, 2)],
  ["Insurance", `${usd(p.annual_insurance_cents)} a year`],
  ["HOA dues", p.monthly_hoa_cents ? `${usd(p.monthly_hoa_cents)} a month` : "None"],
];
