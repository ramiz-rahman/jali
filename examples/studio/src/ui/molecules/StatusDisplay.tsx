/**
 * An empty or missing state, as the hardware would show it: a small display with a dark lamp and a short code, the
 * title printed under it, a line of help, and a key to recover when there is one. `missing` is an object that is
 * gone: the display reads "no signal". `empty` is a list with nothing in it.
 */
import type { ReactNode } from "react";
import { Key } from "../atoms/Key";
import { Lamp } from "../atoms/Lamp";

export function StatusDisplay({
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
        <Lamp />
        <span className="empty-code">{kind === "missing" ? "no signal" : "– – : – –"}</span>
      </div>
      <b className="empty-title">{title}</b>
      {children ? <p>{children}</p> : null}
      {action ? <Key onClick={action.run}>{action.label}</Key> : null}
    </div>
  );
}
