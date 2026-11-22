import { useEffect, useRef, useState } from "react";
import { keepPaneFocus, ALONE_CHROME, CHROME, currentPane } from "@jali/core/adapter";
import { FoldLine, StackDivider, useKeyboardUp, useStackAnnouncement } from "./Stacked";
import { placement } from "./placement";
import { PaneSwitcher } from "../chrome/PaneSwitcher";
import { Peek } from "../chrome/Peek";
import { DividerLayer } from "../dividers/DividerLayer";
import { PaneFrame } from "../pane/PaneFrame";
import { ContentHosts, PaneContent, useContentHosts } from "../pane/content";
import { Strip, useFocusIntoStrip } from "./Scroller";
import { useGeometry, useStore, useUi } from "../state/react";
import { useHydrated } from "../state/hydrated";
import { PAGE_PARTS } from "../page-parts";
import { useUniqueName, useWorkspaceLabel } from "../a11y/landmark";
import { useEngaged, useMeasure } from "./element";
import { useFoldAnnouncements } from "./announce";
import { useReshapeMotion } from "./motion";
import { DragLayer } from "./DragLayer";
import { useFullScreen } from "./fullscreen";

/** The panes: the layout, its dividers, tabs, the shelf, the peek sheet and drop previews. */
export function Panes() {
  const store = useStore();
  // Not for a live title: each frame, tab and the drag chip reads its own.
  const m = useGeometry();
  const view = useUi((s) => s.view);
  const area = useUi((s) => s.area);
  // Where a drag would land, not where its pointer is: the pointer is DragLayer's.
  const dropTarget = useUi((s) => s.dnd?.target);
  const dragging = useUi((s) => !!s.dnd);
  const ghost = useUi((s) => s.ghost);
  // A curated page's ⌥ preview, which its parts bring (definePage).
  const Ghost = store.env.profile?.[PAGE_PARTS]?.Ghost;
  const sliding = useReshapeMotion(useUi((s) => s.reshapes));
  const hydrated = useHydrated();
  const ref = useMeasure(store);
  useFullScreen(store, m);
  const fullScreen = useUi((s) => !!s.fullScreen && !!m.pane(s.fullScreen));
  useFoldAnnouncements(store, m, area);
  // Keep DOM focus on the focused pane after structural changes (focus is never lost), but only once the person has
  // been in this instance: mounting one, or a change while they are elsewhere on the page, leaves their place alone.
  const engaged = useEngaged(store);
  useEffect(() => {
    if (!store.focusHeld) keepPaneFocus(store.dom, view.focused, { fromBody: engaged.current });
  }, [view.focused, m.layout]);

  const single = m.onePane;
  // A curated page in Single mode shows one view under its tabs: the tabs name it, so the pane has no header.
  const page = useUi((s) => s.page?.mode);
  // Stacked view (a portrait phone, phone.stack): two linked panes, unless the keyboard is up.
  const keyboardUp = useKeyboardUp();
  // The top pane's share once the person moves the divider; until then the kinds' heights decide it.
  const [stackRatio, setStackRatio] = useState<number | undefined>(undefined);
  // Every frame's final rect and the divider, from one calculation (placement.ts).
  const {
    presentation: mode,
    alone,
    stacked,
    inner,
    bleed,
    frames: placed,
    divider,
  } = placement(m, view, { area, page: !!page, keyboardUp, share: stackRatio });
  // One pane on screen, tiled, is quiet, as a plain tab strip would be (ALONE_CHROME).
  const chrome = single ? CHROME.single : alone ? ALONE_CHROME : CHROME.tiled;
  useStackAnnouncement(store, m, stacked);
  useFocusIntoStrip(store);
  // Each pane's content, rendered once in this flat list whatever frame shows it (content.tsx). Not while hydrating
  // a server's HTML, which has the content inside the frames.
  const hosts = useContentHosts(store, useRef(hydrated).current);
  useEffect(() => hosts.keep(new Set(placed.map((f) => f.node.id))));

  // A labelled region inside the host's page, or the page's main landmark when the host says Jali is the whole app.
  // Named by <JaliRoot aria-label>, a heading it points at, createJali({ label }), or Jali's own word.
  const Landmark = store.env.landmark === "main" ? "main" : "section";
  const content = hosts.get
    ? placed.map((f) => <PaneContent key={f.node.id} frame={f} at={hosts.get!(f.node.id)} />)
    : null;
  const named = useWorkspaceLabel();
  const name = named.by ? undefined : (named.label ?? store.messages.panes.label);
  useUniqueName(named.by ?? name!);
  return (
    <ContentHosts.Provider value={hosts.get}>
      <Landmark
        className={["jali-layout", single && "is-one-pane", sliding && !single && "is-reshaping"]
          .filter(Boolean)
          .join(" ")}
        ref={ref}
        aria-label={name}
        aria-labelledby={named.by}
        data-one-pane={single ? "" : undefined}
        data-stacked={stacked ? "" : undefined}
        data-fold={stacked ? m.stacked?.hinge?.axis : undefined}
        data-full-screen={fullScreen ? "" : undefined}
        data-alone={alone ? "" : undefined}
        data-zoomed={!single && view.zoomed ? "" : undefined}
        data-page={page}
      >
        {single && !page ? (
          <PaneSwitcher
            panes={m.onScreen}
            current={currentPane(m, view)}
            inView={stacked && m.stacked ? [m.stacked.top, m.stacked.bottom] : undefined}
          />
        ) : null}
        <div className="jali-layout-inner" style={bleed}>
          {placed
            .filter((f) => !f.strip)
            .map((f) => (
              <PaneFrame
                key={f.node.id}
                frame={f}
                chrome={chrome}
                dropTarget={!single && dropTarget === f.node.id}
              />
            ))}
          {single ? null : <DividerLayer />}
          {/* Rows that scroll sideways: their panes and dividers inside an element the browser scrolls. */}
          {single
            ? null
            : m.content.scrollers.map((s) => (
                <Strip
                  key={s.id}
                  strip={s}
                  zoomed={!!view.zoomed && s.paneIds.includes(view.zoomed)}
                >
                  {placed
                    .filter((f) => f.strip === s.id)
                    .map((f) => (
                      <PaneFrame
                        key={f.node.id}
                        frame={f}
                        chrome={chrome}
                        dropTarget={dropTarget === f.node.id}
                      />
                    ))}
                  <DividerLayer strip={s} />
                </Strip>
              ))}
          {stacked && m.stacked?.hinge ? <FoldLine hinge={m.stacked.hinge} origin={inner} /> : null}
          {divider ? (
            <StackDivider m={m} at={divider} setRatio={setStackRatio} height={inner.height} />
          ) : null}
          {single ? null : <DragLayer m={m} />}
          {Ghost && ghost && !single && !dragging ? <Ghost role={ghost} /> : null}
          <Peek presentation={mode} />
        </div>
        {content}
      </Landmark>
    </ContentHosts.Provider>
  );
}
