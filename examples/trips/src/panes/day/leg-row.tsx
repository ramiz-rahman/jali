/** The way between two places in a day: its mode (the city's choices), minutes and fare. The flight is fixed. */
import { AirplaneTiltIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { useServices } from "../../state/services";
import { modeName, wordsFor } from "../../trip/modes";
import { mustPlace } from "../../trip/places";
import { FLIGHT, type Leg } from "../../trip/travel";
import * as f from "../../ui/format";
import { modeIcon } from "../../ui/icons";

export function LegRow({ leg }: { leg: Leg }) {
  return leg.mode === "flight" ? <FlightLeg leg={leg} /> : <RideLeg leg={leg} />;
}

function FlightLeg({ leg }: { leg: Leg }) {
  return (
    <div className="leg leg-flight" data-mode="flight">
      <span className="leg-line" aria-hidden />
      <span className="leg-flight-mark" aria-hidden>
        <AirplaneTiltIcon size={16} weight="bold" />
      </span>
      <span className="leg-text">
        <span className="num">{f.minutes(FLIGHT.airMin)} flight</span>
        <span className="muted">
          {f.distance(leg.km)}, {f.money(leg.cost)}, with {f.minutes(FLIGHT.airportMin)} at the
          airports
        </span>
      </span>
    </div>
  );
}

function RideLeg({ leg }: { leg: Leg }) {
  const { changes } = useServices();
  const to = mustPlace(leg.to);
  const name = (mode: Leg["mode"]) => modeName({ mode, ferry: leg.ferry }, leg.city);
  return (
    <div className="leg" data-mode={leg.mode}>
      <span className="leg-line" aria-hidden />
      <div className="leg-modes" role="group" aria-label={`How to get to ${to.name}`}>
        {leg.options.map((mode) => {
          const Icon = modeIcon({ mode, ferry: leg.ferry });
          const on = leg.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              title={
                on && leg.chosen
                  ? `${name(mode)} (your choice; press again for the suggestion)`
                  : name(mode)
              }
              onClick={() => changes.chooseMode(leg, mode)}
            >
              <Icon size={15} weight={on ? "bold" : "regular"} aria-hidden />
              <span className="sr-only">{name(mode)}</span>
            </button>
          );
        })}
      </div>
      <span className="leg-text">
        <span className="leg-time">
          <span className="num">{f.minutes(leg.minutes)}</span> {wordsFor(leg).leg}
        </span>
        <span className="muted">
          {f.distance(leg.km)}, {leg.cost ? f.money(leg.cost) : "free"}
        </span>
      </span>
      {leg.chosen ? (
        <button
          type="button"
          className="leg-reset"
          title="Go back to the suggested mode"
          onClick={() => changes.suggestedMode(leg)}
        >
          <ArrowsClockwiseIcon size={13} aria-hidden />
          <span className="sr-only">Use the suggested mode</span>
        </button>
      ) : null}
    </div>
  );
}
