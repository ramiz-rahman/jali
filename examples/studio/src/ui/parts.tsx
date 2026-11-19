/** Small parts the panes share. */
import type { ReactNode } from "react";
import type { ObjectRef } from "@jali/core";
import { PlayIcon } from "@phosphor-icons/react";
import { cue } from "../actions";
import { useServices } from "../services";
import { sessionById } from "../sessions/sessions";
import { useTransport } from "../audio/react";

/**
 * An empty or missing state, as the hardware would show it: a small display with a dark lamp and a short code, the
 * title printed under it, a line of help, and a key to recover when there is one. `missing` is an object that is
 * gone (a pane whose session no longer exists): the display reads "no signal". `empty` is a list with nothing in it.
 */
export function Empty({
  title,
  children,
  kind = "empty",
  action,
}: {
  title: string;
  children?: ReactNode;
  kind?: "empty" | "missing";
  action?: { label: string; run(): void };
}) {
  return (
    <div className="empty" role="status" data-kind={kind}>
      <div className="screen empty-screen" aria-hidden>
        <span className="led" />
        <span className="empty-code">{kind === "missing" ? "no signal" : "– – : – –"}</span>
      </div>
      <b className="empty-title">{title}</b>
      {children ? <p>{children}</p> : null}
      {action ? (
        <button type="button" className="key" onClick={action.run}>
          {action.label}
        </button>
      ) : null}
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
      <span>Not in the transport{playing ? <>: it has “{playing}”</> : null}.</span>
      <button type="button" className="key key-s" onClick={() => cue(engine, session, 0)}>
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

/** A pane whose object is gone: "no signal", and a key that shows the library in its place. */
export function Missing({
  what,
  openHere,
}: {
  what: "session" | "segment";
  openHere(ref: ObjectRef): unknown;
}) {
  return (
    <Empty
      kind="missing"
      title={what === "session" ? "This session is gone" : "This segment is gone"}
      action={{ label: "show the library", run: () => openHere({ kind: "library", params: {} }) }}
    >
      It may have been removed, or the link is from another copy of Studio.
    </Empty>
  );
}
