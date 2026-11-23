/** What Split (⌘\) and a tab strip's "+" open: choose what this pane shows. */
import type { KeyboardEvent } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { definePane, useLauncher, type PaneProps } from "jali/react";
import { usePlan } from "../../state/services";
import { DayMark } from "../../ui/atoms/day-mark";
import {
  budgetRef,
  dayRef,
  exploreRef,
  KIND,
  mapRef,
  tripRef,
  WHOLE_TRIP,
} from "../../workspace/refs";
import "./launcher.css";

function Launcher({ openHere, dismiss }: PaneProps) {
  const plan = usePlan();
  const { recent, titleOf } = useLauncher();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    }
  };
  return (
    <nav
      className="pane-body launcher"
      aria-label="Choose what this pane shows"
      onKeyDown={onKeyDown}
    >
      <section>
        <h3>A day</h3>
        <div className="launcher-grid">
          {plan.days.map((d) => (
            <button
              key={d.n}
              type="button"
              className="btn launcher-day"
              onClick={() => openHere(dayRef(d.n))}
            >
              <DayMark n={d.n} size="sm" />
              {d.title}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>The trip</h3>
        <div className="launcher-grid">
          <button
            type="button"
            className="btn"
            onClick={() => openHere(mapRef(WHOLE_TRIP))}
            autoFocus
          >
            Trip map
          </button>
          <button type="button" className="btn" onClick={() => openHere(tripRef())}>
            Trip overview
          </button>
          <button type="button" className="btn" onClick={() => openHere(exploreRef())}>
            Explore
          </button>
          <button type="button" className="btn" onClick={() => openHere(exploreRef("stay"))}>
            Find a stay
          </button>
          <button type="button" className="btn" onClick={() => openHere(budgetRef())}>
            Budget
          </button>
        </div>
      </section>
      {recent.length ? (
        <section>
          <h3>Recent</h3>
          <div className="launcher-grid">
            {recent.map((ref) => (
              <button
                key={JSON.stringify(ref)}
                type="button"
                className="btn"
                onClick={() => openHere(ref)}
              >
                {titleOf(ref)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </nav>
  );
}

export const launcher = definePane(KIND.launcher, {
  title: "New pane",
  icon: PlusIcon,
  width: { min: 300 },
  height: { min: 240 },
  scratch: true,
  Component: Launcher,
});
