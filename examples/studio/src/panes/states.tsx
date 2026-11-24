/**
 * The states a pane shows instead of its object: the object is gone (a link from another copy of Studio), or its
 * session isn't the one in the transport.
 */
import type { ObjectRef } from "jali-layout";
import type { MissingProps } from "jali-layout/react";
import { PlayIcon } from "@phosphor-icons/react";
import { useTransport } from "../audio/react";
import { useServices } from "../services";
import { catalogueOf } from "../sessions/catalog";
import type { SessionId } from "../sessions/ids";
import { Key } from "../ui/atoms/Key";
import { StatusDisplay } from "../ui/molecules/StatusDisplay";
import { libraryRef } from "./refs";

/** A pane whose object is gone: "no signal", and a key that shows the library in its place. */
export function Missing({
  what,
  openHere,
}: {
  what: "session" | "segment";
  openHere(ref: ObjectRef): unknown;
}) {
  return (
    <StatusDisplay
      kind="missing"
      title={`This ${what} is gone`}
      action={{ label: "show the library", run: () => openHere(libraryRef()) }}
    >
      It may have been removed, or the link is from another copy of Studio.
    </StatusDisplay>
  );
}

/** A kind's `Missing` for a session that isn't in the library: Jali shows it when a link names one. */
export const SessionMissing = ({ openHere }: MissingProps) => (
  <Missing what="session" openHere={openHere} />
);

/** The same for a segment the session doesn't have. */
export const SegmentMissing = ({ openHere }: MissingProps) => (
  <Missing what="segment" openHere={openHere} />
);

/**
 * A pane showing a session the transport is not playing (kept to compare, or kept by its unsaved work while the
 * library moved on). One key puts it in the transport.
 */
export function NotInTransport({ session }: { session: SessionId }) {
  const { engine } = useServices();
  const playing = useTransport((s) => catalogueOf(s.session).title);
  return (
    <div className="not-live" role="note" title={`The transport has “${playing}”.`}>
      <span>Not loaded.</span>
      <Key className="key-s" onClick={() => engine.cue(session, 0)}>
        <PlayIcon size={12} weight="fill" aria-hidden /> load
      </Key>
    </div>
  );
}
