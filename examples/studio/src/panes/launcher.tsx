/** What Split (⌘\) and a tab strip's "+" open: choose a view of the session in the transport, or the library. */
import type { KeyboardEvent } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import type { ObjectRef } from "@jali/core";
import { definePane, useLauncher, type PaneProps } from "@jali/react";
import { useTransport } from "../audio/react";
import { sessionById } from "../sessions/sessions";
import { library } from "./library";
import { markers } from "./markers";
import { mixer } from "./mixer";
import { timeline } from "./timeline";
import { transcript } from "./transcript";

const VIEWS = [
  { label: "Transcript", make: transcript },
  { label: "Timeline", make: timeline },
  { label: "Mixer", make: mixer },
  { label: "Markers", make: markers },
] as const;

function Launcher({ openHere, dismiss }: PaneProps) {
  const session = useTransport((s) => s.session);
  const { recent, titleOf, isOpen } = useLauncher();
  const go = (ref: ObjectRef) => openHere(ref);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss(); // an untouched launcher closes quietly
    }
  };
  return (
    <nav
      className="pane-body launcher"
      aria-label="Choose what this pane shows"
      onKeyDown={onKeyDown}
    >
      <section>
        <h3 className="pane-label">{sessionById(session)?.title}</h3>
        <div className="launcher-grid">
          {VIEWS.map((v, i) => (
            <button
              key={v.label}
              type="button"
              className="btn"
              autoFocus={i === 0}
              onClick={() => go(v.make({ session }))}
            >
              {v.label}
            </button>
          ))}
          <button type="button" className="btn" onClick={() => go(library())}>
            Library
          </button>
        </div>
      </section>
      {recent.length ? (
        <section>
          <h3 className="pane-label">Recent</h3>
          <div className="launcher-grid">
            {recent.map((ref) => (
              <button
                key={JSON.stringify(ref)}
                type="button"
                className="btn"
                onClick={() => go(ref)}
                title={isOpen(ref) ? "Open in another pane: goes there" : undefined}
              >
                {titleOf(ref)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </nav>
  );
}

export const launcher = definePane("launcher", {
  title: "New pane",
  icon: PlusIcon,
  width: { min: 260 },
  height: { min: 200 },
  scratch: true,
  Component: Launcher,
});
