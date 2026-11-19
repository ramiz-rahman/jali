/** Small parts the panes share. */
import type { ReactNode } from "react";
import { PlayIcon } from "@phosphor-icons/react";
import { cue } from "../actions";
import { useServices } from "../services";
import { sessionById } from "../sessions/sessions";
import { useTransport } from "../audio/react";

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <b>{title}</b>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

/**
 * A pane showing a session the transport is not playing (kept to compare, or kept by its unsaved work while the
 * library moved on). One button puts it in the transport.
 */
export function NotInTransport({ session }: { session: string }) {
  const { engine } = useServices();
  const playing = useTransport((s) => sessionById(s.session)?.title);
  return (
    <div className="not-live" role="note">
      <span>
        Not in the transport{playing ? <>: it has “{playing}”</> : null}.
      </span>
      <button type="button" className="btn btn-quiet" onClick={() => cue(engine, session, 0)}>
        <PlayIcon size={12} weight="fill" aria-hidden /> Load this session
      </button>
    </div>
  );
}

/** A group of toggle buttons, one pressed. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`segmented ${className ?? ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          title={o.title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
