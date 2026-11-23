/**
 * The budget, as a traveller keeps one: the hotels and the flight booked ahead, then what is left shared evenly
 * between the days, to spend on sights, food and getting around. A day that spends more than that is marked with
 * words and an icon, not colour alone. The charts are drawn by hand in CSS (charts.tsx): by day, each day's spending
 * against its allowance; by category, the whole trip. By day, the days are a list: Budget's layout has the map and
 * the day plan follow it, so moving through the days (J/K or the arrows) shows each one's spending on the map.
 */
import { WalletIcon } from "@phosphor-icons/react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "jali/react";
import { stringIn } from "../../state/saved";
import { useSummary } from "../../state/services";
import { dayNumber } from "../../trip/plan";
import { useCursorList } from "../../ui/cursor-list";
import { BUDGET_CATEGORIES, BUDGET_LABEL, SPENDING } from "../../trip/budget";
import * as f from "../../ui/format";
import { Segmented } from "../../ui/segmented";
import { showDay } from "../../workspace/hub";
import { dayNumberOf, dayRef, KIND } from "../../workspace/refs";
import { BudgetField } from "./budget-field";
import { Bookings } from "./bookings";
import { ByCategory, ByDay } from "./charts";
import "./budget.css";

type View = "day" | "category";

function BudgetPane({ node, focused, select, inPeek }: PaneProps) {
  const jali = useJali();
  const summary = useSummary();
  const { plan, budget: b } = summary;
  const [view, setView] = usePaneState<View>("view", "day", { parse: stringIn("day", "category") });
  // The cursor is on the day Jali has selected, as in the overview: it starts on the day its followers show.
  const [kept, setCursor] = usePaneState<number>("cursor", 1, { parse: dayNumber });
  const selected = useJaliState((s) => dayNumberOf(s.selection[node.id]?.ref));
  const cursor = (!inPeek && selected) || kept;
  const moveTo = (n: number) => {
    setCursor(n);
    select(dayRef(n));
  };
  const list = useCursorList({
    items: plan.days.map((d) => d.n),
    cursor,
    onMove: moveTo,
    onOpen: (n) => showDay(jali, n),
    actions: [
      {
        id: "open-day",
        title: `Open Day ${cursor}`,
        keys: ["Enter"],
        run: () => showDay(jali, cursor),
      },
    ],
  });
  useCommands(inPeek || view !== "day" ? [] : list.commands);

  return (
    <div className="pane-body budget">
      <header className="budget-head">
        <div>
          <p className="budget-total">
            <span className="num">{f.moneyRound(b.total)}</span>
          </p>
          <p className="muted">
            planned of a {f.moneyRound(b.budget)} budget,{" "}
            {b.left >= 0 ? (
              <>{f.moneyRound(b.left)} left</>
            ) : (
              <b className="over-text">{f.moneyRound(-b.left)} over</b>
            )}
          </p>
        </div>
        <BudgetField budget={plan.budget} disabled={inPeek} />
      </header>

      <Bookings budget={b} disabled={inPeek} />

      <div className="budget-toolbar">
        <h3 className="budget-heading">
          {view === "day" ? (
            <>
              <span className="num">{f.money(b.allowance)}</span> a day to spend
            </>
          ) : (
            "The whole trip"
          )}
        </h3>
        <Segmented
          label="Show by"
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "By day" },
            { value: "category", label: "By category" },
          ]}
        />
      </div>
      <ul className="budget-key" aria-label="Categories">
        {(view === "day" ? SPENDING : BUDGET_CATEGORIES).map((c) => (
          <li key={c} data-cat={c}>
            {BUDGET_LABEL[c]}
          </li>
        ))}
      </ul>

      {view === "day" ? (
        <ByDay
          summary={summary}
          list={{
            idPrefix: `${node.id}-day`,
            cursor,
            active: focused,
            onKeyDown: list.onKeyDown,
            press: list.press,
            listProps: list.listProps,
          }}
        />
      ) : (
        <ByCategory budget={b} />
      )}

      <p className="budget-note muted small">
        <WalletIcon size={14} aria-hidden /> The hotels and the flight are booked ahead. What is
        left of the budget, {f.money(Math.max(0, b.budget - b.booked))}, is shared between the{" "}
        {plan.days.length} days for sights, food and getting around. A leg's mode counts on its day,
        so a scooter instead of a taxi in Phuket shows here. Every price in this example is made up.
      </p>
    </div>
  );
}

export const budget = definePane(KIND.budget, {
  title: "Budget",
  icon: WalletIcon,
  // By day, a list of days: with none selected, it starts on the one its following day plan shows.
  selects: KIND.day,
  width: { min: 340, comfortable: 460, max: 640 },
  height: { min: 300 },
  Component: BudgetPane,
});
