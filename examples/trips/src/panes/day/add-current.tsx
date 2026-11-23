/** The place selected elsewhere, offered for this day when it is in the day's city. */
import { usePlan, useServices } from "../../state/services";
import { mustPlace } from "../../trip/places";
import { canPlan, standingOf, type Day } from "../../trip/plan";
import { offerLabel } from "../../workspace/choosers";

export function AddCurrent({ id, day }: { id: string; day: Day }) {
  const { changes } = useServices();
  const plan = usePlan();
  if (!canPlan(plan, id, day.n)) return null;
  const p = mustPlace(id);
  const standing = standingOf(plan, id);
  return (
    <div className="add-current">
      <span>
        <b>{p.name}</b>
        <span className="muted">
          {standing.kind === "stop" ? `, on Day ${standing.day.n}` : ", not planned"}
        </span>
      </span>
      <button type="button" className="btn btn-primary" onClick={() => changes.addToDay(id, day.n)}>
        {offerLabel(standing, day.n)}
      </button>
    </div>
  );
}
