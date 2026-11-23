/**
 * The transcript: the words, by speaker and line, lit up as they play. It follows the library, and it is a list
 * itself: its cursor selects a line, and the segment detail beside it follows.
 *
 * Keys, while the transcript has focus: J/K or the arrows move, Enter plays from the line, ⌥Enter opens its detail,
 * E corrects it, L loops it, ⇧Space peeks it, ⌘S saves. Space is the transport's.
 *
 * Its parts: the corrections (useCorrections.ts), following playback (useFollowPlayback.ts), what scrolls the list
 * (useScrolling.ts), the toolbar (Toolbar.tsx) and the rows (Segment.tsx), with what it works out about its lines in
 * lines.ts. A row is memoised: as the playhead moves, only the line being spoken draws again.
 */
import { Fragment, useMemo, useState } from "react";
import {
  NotePencilIcon,
  PlayIcon,
  RepeatIcon,
  TextAlignLeftIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { keyHint, type Jali, type ObjectRef } from "jali";
import { useJali, usePaneState } from "jali/react";
import { usePosition } from "../../audio/react";
import { useServices } from "../../services";
import { catalogueOf } from "../../sessions/catalog";
import { segmentIndexAt, segmentIndexNear } from "../../sessions/derive";
import { capitalise, clock, missionTime } from "../../sessions/format";
import type { SessionId } from "../../sessions/ids";
import type { SegmentData } from "../../sessions/types";
import { asBoolean } from "../../storage";
import { useHandlers } from "../../ui/lib/useHandlers";
import { useListbox } from "../../ui/lib/listbox";
import { usePaneActions, type PaneAction } from "../actions";
import { clip, clipOf } from "../clip";
import { openFollowing } from "../links";
import { sessionOf } from "../refs";
import { defineSessionPane, type SessionPaneProps } from "../sessionPane";
import { NotInTransport } from "../states";
import { useSelectionCursor } from "../useSelectionCursor";
import { overlapsOf, progressOf, sectionsOf } from "./lines";
import { Segment, type LineHandlers } from "./Segment";
import { Toolbar, type TranscriptActions } from "./Toolbar";
import { useCorrections } from "./useCorrections";
import { useFollowPlayback } from "./useFollowPlayback";
import { useScrolling } from "./useScrolling";

/** Select `segment` in the transcript that shows its session, if one is open: its detail follows. */
export function selectSegment(jali: Jali, session: SessionId, segment: string) {
  const pane = jali
    .model()
    .panes.find((p) => p.ref.kind === transcript.kind && sessionOf(p.ref) === session);
  if (pane) jali.actions.select(pane.id, clip({ session, segment }));
}

function Transcript({ node, paused, focused, select, peek, view, transport }: SessionPaneProps) {
  const { engine } = useServices();
  const jali = useJali();
  const { session } = view;
  const segs = session.segments;
  const word = catalogueOf(session).words.segment;
  const [follow, setFollow] = usePaneState("follow", true, { parse: asBoolean });
  // Apollo's lines can be timed on the mission clock (GET), as NASA's transcript prints them.
  const [onGet, setOnGet] = usePaneState("get", false, { parse: asBoolean });
  /** The line whose speaker is being renamed (the name changes everywhere). */
  const [renaming, setRenaming] = useState<string | null>(null);
  const corrections = useCorrections(view);
  const ids = useMemo(() => segs.map((s) => s.id), [segs]);
  const cursor = useSelectionCursor({
    node,
    ids,
    idOf: (ref: ObjectRef | undefined) => {
      const c = clipOf(ref);
      return c?.session === session.id ? c.segment : undefined;
    },
    choose: (id) => select(clip({ session: session.id, segment: id })),
    // A new session (the library moved on): the line under the playhead, or the first.
    fallback: () =>
      segs[transport.inTransport ? segmentIndexNear(session, engine.position()) : 0]!.id,
    scope: session.id,
  });
  const at = Math.max(0, cursor.at);
  const current = segs[at]!;
  const pos = usePosition(paused || !transport.inTransport, 0.05);
  const playhead = transport.inTransport ? pos : -1;
  const speaking = transport.inTransport ? segmentIndexAt(session, playhead) : -1;
  const following = follow && !corrections.editing;
  useFollowPlayback(following && transport.playing, session, {
    current: current.id,
    moveTo: cursor.moveTo,
  });

  const sections = useMemo(() => sectionsOf(view.markers, segs), [view.markers, segs]);
  const overlaps = useMemo(() => overlapsOf(segs), [segs]);

  const refOf = (seg: SegmentData) => clip({ session: session.id, segment: seg.id });
  const playFrom = (seg: SegmentData) => engine.cue(session.id, seg.start, true);
  const openDetail = (seg: SegmentData) => {
    if (seg.id !== current.id) cursor.moveTo(seg.id);
    openFollowing(jali, node.id, refOf(seg));
  };
  const edit = (seg: SegmentData) => {
    cursor.moveTo(seg.id);
    corrections.startEditing(seg.id);
  };
  const looping = (seg: SegmentData) => transport.loop?.segment === seg.id;
  const noCorrections = corrections.count ? false : "No unsaved corrections";

  const actions: TranscriptActions = {
    save: {
      id: "save",
      title: "Save corrections",
      keys: [{ key: "s", mod: true }],
      disabled: noCorrections,
      run: corrections.save,
      face: (
        <>
          save <kbd>{keyHint("Mod+S")}</kbd>
        </>
      ),
    },
    discard: {
      id: "discard",
      title: "Discard unsaved corrections",
      disabled: noCorrections,
      run: corrections.discard,
      face: "discard",
    },
    play: {
      id: "play",
      title: `Play from this ${word}`,
      keys: [{ key: "Enter" }],
      run: () => playFrom(current),
      face: <Face Icon={PlayIcon} word="play" fill />,
    },
    edit: {
      id: "edit",
      title: `Correct this ${word}`,
      keys: [{ key: "e" }],
      run: () => edit(current),
      face: <Face Icon={NotePencilIcon} word="correct" />,
    },
    detail: {
      id: "detail",
      title: `Open this ${word}'s detail`,
      keys: [{ key: "Enter", alt: true }],
      run: () => openDetail(current),
      face: <Face Icon={TextAlignLeftIcon} word="detail" />,
    },
    loop: {
      id: "loop",
      title: looping(current) ? `Stop looping this ${word}` : `Loop this ${word}`,
      keys: [{ key: "l" }],
      latched: looping(current),
      run: () => engine.toggleSegmentLoop(session.id, current),
      face: <Face Icon={RepeatIcon} word="loop" />,
    },
    rename: {
      id: "rename",
      title: `Rename ${view.speakerName(view.speakerOf(current))}`,
      run: () => setRenaming(current.id),
      face: <Face Icon={UserIcon} word="rename" />,
    },
    follow: {
      id: "follow",
      title: follow ? "Stop following playback" : "Follow playback",
      tip: `Move the selection, and the ${word} detail, with the ${word} being heard`,
      latched: follow,
      run: () => setFollow(!follow),
      face: "follow",
    },
    get: session.clock
      ? {
          id: "get",
          title: "Time the lines on the mission clock (GET)",
          tip: "Time the lines on the mission clock (GET), as NASA's transcript prints them",
          latched: onGet,
          run: () => setOnGet(!onGet),
          face: "GET",
        }
      : undefined,
  };
  const onActionKey = usePaneActions([
    ...Object.values(actions).filter((a): a is PaneAction => a !== undefined),
    {
      id: "peek",
      title: "Peek",
      keyOnly: true,
      keys: [{ key: " ", shift: true }],
      run: () => peek(refOf(current)),
    },
  ]);

  const list = useListbox({
    id: node.id,
    count: segs.length,
    at,
    focused,
    onMove: (i) => cursor.moveTo(segs[i]!.id),
    // Not ours: it bubbles on (Space plays and pauses, ⌘K opens commands).
    onKey: onActionKey,
    // The list follows the voice and the cursor's arrival itself (useScrolling).
    reveal: "keys",
  });
  useScrolling(list.ref, { paused, session: session.id, cursor: at, speaking, following });

  const on = useHandlers<LineHandlers>({
    select: (seg) => cursor.moveTo(seg.id),
    seek: (t) => engine.cue(session.id, t, transport.playing),
    edit,
    change: (seg, text) => corrections.write(seg.id, text),
    doneEditing: () => {
      corrections.stopEditing();
      list.ref.current?.focus();
    },
    save: () => corrections.save(),
    rename: (seg) => setRenaming(seg.id),
    renamed: (seg, newName) => {
      if (newName?.trim()) view.edit.renameSpeaker(view.speakerOf(seg), newName);
      setRenaming(null);
    },
  });

  return (
    <div className="pane-body transcript">
      <Toolbar
        label={`${capitalise(word)} ${at + 1} of ${segs.length}`}
        actions={actions}
        at={at + 1}
        total={segs.length}
        unsaved={corrections.count}
        corrected={Object.keys(view.edits.corrections).length}
      />
      {!transport.inTransport ? <NotInTransport session={session.id} /> : null}
      <div
        {...list.props}
        className="tr-rows"
        aria-label={`${catalogueOf(session).words.transcript} of ${session.title}`}
      >
        {segs.map((seg, i) => {
          const text = corrections.textOf(seg);
          const prev = segs[i - 1];
          // A marker is a heading over the first line at or after it: a section of the song, a topic at dinner, a
          // moment of the landing. Headings are print on the paper, not rows: the list's options stay the lines.
          const heading = sections.get(seg.id);
          return (
            <Fragment key={seg.id}>
              {heading ? (
                <div className="tr-section" aria-hidden>
                  {heading}
                </div>
              ) : null}
              <Segment
                row={list.row(i)}
                seg={seg}
                view={view}
                on={on}
                text={text}
                time={(onGet && missionTime(session, seg.start)) || clock(seg.start)}
                showSpeaker={
                  !prev ||
                  view.speakerOf(prev) !== view.speakerOf(seg) ||
                  renaming === seg.id ||
                  !!heading
                }
                overlaps={overlaps.has(seg.id)}
                progress={progressOf(seg, playhead, view.wordsOf(seg, text))}
                unsaved={corrections.isChanged(seg.id)}
                corrected={view.isCorrected(seg)}
                looping={looping(seg)}
                editing={corrections.editing === seg.id}
                renaming={renaming === seg.id}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** A toolbar key's face: its glyph and its word. */
function Face({ Icon, word, fill }: { Icon: typeof PlayIcon; word: string; fill?: boolean }) {
  return (
    <>
      <Icon size={14} weight={fill ? "fill" : undefined} aria-hidden />
      <span className="key-word">{word}</span>
    </>
  );
}

export const transcript = defineSessionPane("transcript", {
  name: (c) => c?.words.transcript ?? "Transcript",
  icon: TextAlignLeftIcon,
  width: { min: 380, comfortable: 560 },
  height: { min: 240 },
  Body: Transcript,
});
