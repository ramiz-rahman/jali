/** What Split (⌘\) and a tab strip's "+" open: choose what this pane shows. */
import type { KeyboardEvent } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import type { ObjectRef } from "@jali/core";
import { definePane, useLauncher, type PaneProps } from "@jali/react";
import { usePlan } from "../services";
import { DayMark } from "../ui/parts";
import { budget } from "./budget";
import { day } from "./day";
import { explore } from "./explore";
import { map } from "./map";
import { trip } from "./trip";

function Launcher({ openHere, dismiss }: PaneProps) {
  const plan = usePlan();
  const { recent, titleOf } = useLauncher();
  const go = (ref: ObjectRef) => openHere(ref);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
    }
  };
  return (
    <nav className="pane-body launcher" aria-label="Choose what this pane shows" onKeyDown={onKeyDown}>
      <section>
        <h3>A day</h3>
        <div className="launcher-grid">
          {plan.days.map((d) => (
            <button key={d.n} type="button" className="btn launcher-day" onClick={() => go(day({ n: d.n }))}>
              <DayMark n={d.n} size="sm" />
              {d.title}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>The trip</h3>
        <div className="launcher-grid">
          <button type="button" className="btn" onClick={() => go(map({ day: 0 }))} autoFocus>
            Trip map
          </button>
          <button type="button" className="btn" onClick={() => go(trip())}>
            Trip overview
          </button>
          <button type="button" className="btn" onClick={() => go(explore({}))}>
            Explore
          </button>
          <button type="button" className="btn" onClick={() => go(explore({ category: "stay" }))}>
            Find a stay
          </button>
          <button type="button" className="btn" onClick={() => go(budget())}>
            Budget
          </button>
        </div>
      </section>
      {recent.length ? (
        <section>
          <h3>Recent</h3>
          <div className="launcher-grid">
            {recent.map((ref) => (
              <button key={JSON.stringify(ref)} type="button" className="btn" onClick={() => go(ref)}>
                {titleOf(ref)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </nav>
  );
}

export const launcher = definePane("launcher", {
  title: "New pane",
  icon: PlusIcon,
  width: { min: 300 },
  height: { min: 240 },
  scratch: true,
  Component: Launcher,
});
