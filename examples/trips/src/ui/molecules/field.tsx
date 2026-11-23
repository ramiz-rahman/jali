/** A labelled select in a row of filters: its caption above, the choice below (ui/select.tsx's parts). */
import { useId } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export function Field<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="select">
      <span id={id}>{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
