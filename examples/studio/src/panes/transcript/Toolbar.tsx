/**
 * The transcript's toolbar: one tray, the width of the sheet below. The follow latch, the line counter and the GET
 * latch; the selected line's playback and edit keys; and, while there are corrections, their count and the keys that
 * keep or drop them. Every cap is one height; caps in a group meet at a seam, groups stand one gap apart. It wraps
 * onto a second row in a narrow pane.
 *
 * Every key on it is one of the transcript's actions (index.tsx), so each is also a command in ⌘K and a key.
 */
import type { ReactNode } from "react";
import { pad } from "../../sessions/format";
import { ActionKey, type PaneAction } from "../actions";

export interface TranscriptActions {
  follow: PaneAction;
  play: PaneAction;
  loop: PaneAction;
  edit: PaneAction;
  rename: PaneAction;
  detail: PaneAction;
  save: PaneAction;
  discard: PaneAction;
  /** The mission clock latch, for a session that has one. */
  get?: PaneAction;
}

export function Toolbar({
  label,
  actions: a,
  at,
  total,
  unsaved,
  corrected,
}: {
  /** The tray's name: "Line 3 of 40". */
  label: string;
  actions: TranscriptActions;
  /** The cursor's line, from 1, of `total`. */
  at: number;
  total: number;
  /** Lines corrected and not yet saved. */
  unsaved: number;
  /** Lines corrected and saved. */
  corrected: number;
}) {
  return (
    <div className="toolbar tr-controls">
      <div className="tray tr-tray" role="toolbar" aria-label={label}>
        <Group>
          <ActionKey action={a.follow} className="key-s key-latch" />
          <span className="lcd tr-counter" aria-hidden>
            <b>{pad(at)}</b>/{pad(total)}
          </span>
          {a.get ? <ActionKey action={a.get} className="key-s key-latch key-caps" /> : null}
        </Group>
        <Group label="Playback">
          <ActionKey action={a.play} className="key-s" />
          <ActionKey action={a.loop} className="key-s key-latch" />
        </Group>
        <Group label="Edit">
          <ActionKey action={a.edit} className="key-s" />
          <ActionKey action={a.rename} className="key-s" />
          <ActionKey action={a.detail} className="key-s" />
        </Group>
        {unsaved ? (
          <Group label="Corrections" className="tr-corrections">
            <span className="lcd tr-counter tr-unsaved" role="status">
              {unsaved} unsaved
            </span>
            <ActionKey action={a.discard} className="key-s" />
            <ActionKey action={a.save} className="key-s key-accent" />
          </Group>
        ) : corrected ? (
          <Group className="tr-corrections">
            <span className="lcd tr-counter">{corrected} corrected</span>
          </Group>
        ) : null}
      </div>
    </div>
  );
}

/** A group of caps on the tray; named, it is a group for a screen reader too. */
function Group({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={className ? `tr-group ${className}` : "tr-group"}
      role={label ? "group" : undefined}
      aria-label={label}
    >
      {children}
    </span>
  );
}
