/** What Split (⌘\) and a tab strip's "+" open: choose a view of the session in the transport, or the library. */
import type { KeyboardEvent } from "react";
import {
  BookmarkSimpleIcon,
  BooksIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TextAlignLeftIcon,
  WaveSineIcon,
} from "@phosphor-icons/react";
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
  { label: "transcript", make: transcript, Icon: TextAlignLeftIcon },
  { label: "timeline", make: timeline, Icon: WaveSineIcon },
  { label: "mixer", make: mixer, Icon: SlidersHorizontalIcon },
  { label: "markers", make: markers, Icon: BookmarkSimpleIcon },
] as const;

/**
 * The launcher: a selector panel. The views of the session in the transport as a row of big keys (the key face:
 * glyph centred, legend under it), the library beside them, and the recent objects on an LCD list.
 */
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
        <div className="keyset launcher-keys">
          {VIEWS.map((v, i) => (
            <button
              key={v.label}
              type="button"
              className="key key-m face"
              autoFocus={i === 0}
              onClick={() => go(v.make({ session }))}
            >
              <v.Icon size={22} aria-hidden className="face-glyph" />
              <span className="face-legend">{v.label}</span>
            </button>
          ))}
        </div>
        <div className="keyset launcher-keys">
          <button type="button" className="key key-m face" onClick={() => go(library())}>
            <BooksIcon size={22} aria-hidden className="face-glyph" />
            <span className="face-legend">library</span>
          </button>
        </div>
      </section>
      {recent.length ? (
        <section>
          <h3 className="pane-label">recent</h3>
          <ul className="lcd launcher-recent">
            {recent.map((ref) => (
              <li key={JSON.stringify(ref)}>
                <button
                  type="button"
                  onClick={() => go(ref)}
                  title={isOpen(ref) ? "Open in another pane: goes there" : undefined}
                >
                  <span>{titleOf(ref)}</span>
                  {isOpen(ref) ? <span className="launcher-open">open</span> : null}
                </button>
              </li>
            ))}
          </ul>
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
