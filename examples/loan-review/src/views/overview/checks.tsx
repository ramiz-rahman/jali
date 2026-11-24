/** "What to check": the assessment's signals, tallied, grouped by the three Cs of underwriting and the loan. */
import { Loading } from "@jali-examples/shared/panes/shared/states";
import type { Assessment } from "../../model/assessment";
import { AREAS, type Signal } from "../../model/signals";
import { plural } from "../../model/words";
import { ToneIcon } from "../parts/marks";

export function Checks({ signals, tally }: Pick<Assessment, "signals" | "tally">) {
  return (
    <section className="ov-checks" aria-label="What to check" style={{ gridArea: "checks" }}>
      <header className="ov-checks-head">
        <h3>What to check</h3>
        <span className="ov-tally">
          {tally.risk ? <span data-tone="risk">{plural(tally.risk, "issue")}</span> : null}
          {tally.warn ? <span data-tone="warn">{tally.warn} to look at</span> : null}
          {!tally.risk && !tally.warn && signals.length ? (
            <span data-tone="ok">Within guidelines</span>
          ) : null}
        </span>
      </header>
      {signals.length ? (
        <div className="ov-areas">
          {AREAS.map((a) => (
            <Area key={a.id} label={a.label} items={signals.filter((s) => s.area === a.id)} />
          ))}
        </div>
      ) : (
        <Loading />
      )}
    </section>
  );
}

/** One of the three Cs (or the loan): its signals, worst first. */
function Area({ label, items }: { label: string; items: Signal[] }) {
  if (!items.length) return null;
  return (
    // The area's worst signal (they come worst first) colours its rule, so a reader sees which C to look at.
    <div className="ov-area" data-tone={items[0]?.tone}>
      <h4>{label}</h4>
      <ul>
        {items.map((s) => (
          <li key={s.id} data-tone={s.tone}>
            <ToneIcon tone={s.tone} />
            <span>
              <b>{s.text}</b>
              {s.detail ? <span className="ov-detail">{s.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
