/**
 * A pane that shows one session: the transcript, the timeline, the mixer and the markers. Each is made the same way
 * and differs only in its body, so the kind is made here once:
 *
 *  - its params are `{ session }`, and its title is its name and the session's title ("Mixer · The Eagle has landed");
 *  - it follows the library: the library selects a session's transcript, and each follower shows that session;
 *  - its body gets the session with the person's edits (`view`) and the transport as this session sees it, and is
 *    never rendered for a session the library doesn't have: the pane says "no signal" instead.
 */
import type { ComponentType } from "react";
import type { ObjectRef } from "jali-layout";
import { definePane, type PaneOptionsReact, type PaneProps } from "jali-layout/react";
import { useSessionTransport, type SessionTransport } from "../audio/react";
import { useSessionView } from "../model/react";
import type { SessionView } from "../model/view";
import { catalogueFor, type Catalogue } from "../sessions/catalog";
import { sessionOf } from "./refs";
import { Missing, SessionMissing } from "./states";

const sessionParams = { session: String };

type Params = { session: string };

export type SessionPaneProps = PaneProps<typeof sessionParams> & {
  view: SessionView;
  transport: SessionTransport;
};

type SessionPaneOptions = Omit<
  PaneOptionsReact<Params>,
  "params" | "title" | "follow" | "Component" | "Missing"
> & {
  /** The pane's name, before the session's title: "Mixer", or one from the session's words ("Lyrics" for a song). */
  name: string | ((catalogue: Catalogue | undefined) => string);
  Body: ComponentType<SessionPaneProps>;
};

/** A follower's `follow`: the selected object's session, if it names one. */
const followSession = (selected: ObjectRef) => {
  const session = sessionOf(selected);
  return session ? { session } : undefined;
};

export function defineSessionPane<const K extends string>(
  kind: K,
  { name, Body, ...options }: SessionPaneOptions,
) {
  function SessionPane(props: PaneProps<typeof sessionParams>) {
    const view = useSessionView(props.params.session);
    const transport = useSessionTransport(props.params.session);
    if (!view) return <Missing what="session" openHere={props.openHere} />;
    return <Body {...props} view={view} transport={transport} />;
  }
  SessionPane.displayName = `SessionPane(${kind})`;
  return definePane(kind, {
    ...options,
    params: sessionParams,
    title: ({ session }) => {
      const c = catalogueFor(session);
      return `${typeof name === "string" ? name : name(c)} · ${c?.title ?? session}`;
    },
    follow: followSession,
    Component: SessionPane,
    Missing: SessionMissing,
  });
}
