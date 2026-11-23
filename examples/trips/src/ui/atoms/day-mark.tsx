import "./day-mark.css";

/** A day's number in its colour: the same mark as its pins on the map. */
export function DayMark({ n, size = "md" }: { n: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span className="day-mark" data-day={n} data-size={size} aria-hidden>
      {n}
    </span>
  );
}
