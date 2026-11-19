/** Small parts the panes share. */
import type { ReactNode } from "react";
import {
  AirplaneTiltIcon,
  BedIcon,
  MopedIcon,
  TrainIcon,
  CarIcon,
  ForkKnifeIcon,
  PersonSimpleWalkIcon,
  StarIcon,
  type Icon,
} from "@phosphor-icons/react";
import type { Category } from "../trip/places";
import type { Mode } from "../trip/travel";

export const CATEGORY_ICON: Record<Category, Icon> = {
  airport: AirplaneTiltIcon,
  sight: StarIcon,
  food: ForkKnifeIcon,
  stay: BedIcon,
};

export const MODE_ICON: Record<Mode, Icon> = {
  walk: PersonSimpleWalkIcon,
  transit: TrainIcon,
  taxi: CarIcon,
  scooter: MopedIcon,
  flight: AirplaneTiltIcon,
};

export function Empty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      {icon}
      <p className="empty-title">{title}</p>
      {children ? <div className="empty-body">{children}</div> : null}
    </div>
  );
}

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`segmented ${className ?? ""}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A day's number in its colour: the same mark as its pins on the map. */
export function DayMark({ n, size = "md" }: { n: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span className="day-mark" data-day={n} data-size={size} aria-hidden>
      {n}
    </span>
  );
}

/** A labelled figure, with an optional line under it: "Travel 1h 17m, $0.40 in fares". */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "over";
}) {
  return (
    <div className="stat" data-tone={tone}>
      <dt>{label}</dt>
      <dd>
        <span className="stat-value num">{value}</span>
        {sub ? <span className="stat-sub">{sub}</span> : null}
      </dd>
    </div>
  );
}
