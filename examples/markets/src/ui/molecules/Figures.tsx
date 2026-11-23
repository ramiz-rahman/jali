/** Label and value pairs in a compact grid (the quote's figures). */
import type { ReactNode } from "react";

export type Figure = readonly [label: string, value: ReactNode];

export function Figures({ rows }: { rows: readonly Figure[] }) {
  return (
    <dl className="figures">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
