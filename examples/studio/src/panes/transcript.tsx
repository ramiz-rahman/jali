/**
 * The transcript: the words, by speaker and segment, lit up as they play. It follows the library, and it is a list
 * itself: its cursor selects a segment, and the segment detail beside it follows.
 *
 * Corrections are the pane's work. They are a draft in pane state (kept through folds, tabs and reloads) until the
 * person saves them, and while there are some the pane reports unsaved work, so closing it, a preset without it, or
 * the library moving on asks first (or, for a following pane, keeps it on its session and says why).
 *
 * Keys, while the transcript has focus: J/K or the arrows move, Enter plays from the segment, ⌥Enter opens its detail,
 * E edits it, L loops it, ⇧Space peeks it, ⌘S saves. Space is the transport's.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  NotePencilIcon,
  PlayIcon,
  RepeatIcon,
  TextAlignLeftIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  useUnsaved,
  type PaneProps,
} from "@jali/react";
import { cue, openFollowing } from "../actions";
import { usePosition, useTransport } from "../audio/react";
import { useSessionView, type SessionView } from "../edits";
import { useServices } from "../services";
import {
  clock,
  segmentById,
  segmentIndexAt,
  segmentIndexNear,
  sessionById,
  wordIndexAt,
  type SegmentData,
} from "../sessions/sessions";
import { Empty, NotInTransport } from "../ui/parts";
import { clip } from "./clip";
import { followSession } from "./follow";
import { listMove } from "./keys";

const transcriptParams = { session: String };

function Transcript(props: PaneProps<typeof transcriptParams>) {
  const { edits } = useServices();
  const view = useSessionView(edits, props.params.session);
  if (!view) return <Empty title="No such session">It may have been removed.</Empty>;
  return <TranscriptBody {...props} view={view} />;
}

function TranscriptBody({
  params,
  node,
  paused,
  focused,
  select,
  peek,
  view,
}: PaneProps<typeof transcriptParams> & { view: SessionView }) {
  const { engine, edits } = useServices();
  const jali = useJali();
  const { session } = view;
  const [draft, setDraft] = usePaneState<Record<string, string>>("draft", {});
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null);
  const [follow, setFollow] = usePaneState("follow", true);
  const [editing, setEditing] = useState<string | null>(null);
  /** The segment whose speaker label is being renamed (the name changes everywhere). */
  const [renaming, setRenaming] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inTransport = useTransport((s) => s.session === session.id);
  const playing = useTransport((s) => s.playing && s.session === session.id);
  const loop = useTransport((s) => s.loop);
  const pos = usePosition(paused || !inTransport, 0.05);
  const playhead = inTransport ? pos : -1;

  const segs = session.segments;
  // The cursor is the transcript's selection in Jali, so "Go to segment…" in ⌘K can move it too.
  const selected = useJaliState((s) => {
    const ref = s.selection[node.id]?.ref;
    return ref?.params.session === session.id ? String(ref.params.segment) : null;
  });
  const at = Math.max(
    0,
    segs.findIndex((s) => s.id === (selected ?? cursor)),
  );
  const current = segs[at]!;
  const changed = Object.keys(draft).filter(
    (id) => draft[id] !== view.textOf(segmentById(session, id)!),
  );
  const count = changed.length;

  // The words Jali shows in "Discard unsaved changes?".
  useUnsaved(
    count > 0 &&
      `${count} unsaved ${count === 1 ? "correction" : "corrections"} in “${session.title}”`,
  );

  // Jali holds a whole follow step when one follower has unsaved work, so unsaved corrections here would stop the
  // timeline, the mixer and the markers following the library too (FINDINGS.md). While there are some, the
  // transcript keeps itself on its session instead (Keep, in its header), and lets go once they are saved or
  // discarded, catching up with the library at once. A Keep the person pressed is theirs: it is left alone.
  const keptForWork = useRef(false);
  const hasWork = count > 0;
  useEffect(() => {
    const me = jali.model().pane(node.id);
    if (!me) return; // the peek sheet: not in the layout
    if (hasWork && me.follows && !me.kept) {
      keptForWork.current = true;
      jali.actions.setKept(node.id, true);
    } else if (!hasWork && keptForWork.current) {
      keptForWork.current = false;
      if (me.kept) jali.actions.setKept(node.id, false);
    }
  }, [hasWork, jali, node.id]);

  // Tell Jali which segment is selected: the detail that follows the transcript shows it.
  const moveTo = (id: string) => {
    setCursor(id);
    select(clip({ session: session.id, segment: id }));
  };

  // On first show, start on the segment the detail already shows (a link, a reload); for a new session (the library
  // moved on), on the segment under the playhead, or the first.
  useEffect(() => {
    const follower = jali.model().panes.find((p) => p.linkedTo === node.id && p.follows);
    const shown = follower?.ref.params.segment;
    const start =
      cursor && segmentById(session, cursor)
        ? cursor
        : typeof shown === "string" && follower?.ref.params.session === session.id
          ? shown
          : segs[inTransport ? segmentIndexNear(session, engine.position()) : 0]!.id;
    moveTo(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const cursorRef = useRef(cursor);
  cursorRef.current = current.id;
  // A new layout may bring a follower showing another segment (Compare starts on segments 4 and 6): the cursor takes
  // the layout's word for it, so the list and its detail agree.
  const presetId = useJaliState((s) => s.presetId);
  const firstPreset = useRef(presetId);
  useEffect(() => {
    if (presetId === firstPreset.current) return;
    firstPreset.current = presetId;
    const follower = jali.model().panes.find((p) => p.linkedTo === node.id && p.follows);
    const shown = follower?.ref.params.segment;
    if (
      follower?.ref.params.session === session.id &&
      typeof shown === "string" &&
      shown !== current.id
    )
      moveTo(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  // Following playback: while the transport plays this session, the cursor (and so the detail) moves with the
  // segment being spoken. This runs while the pane is hidden too: it is a few checks a second, not drawing.
  useEffect(() => {
    if (!follow || !playing || editing) return;
    const t = setInterval(() => {
      const i = segmentIndexAt(session, engine.position());
      if (i >= 0 && segs[i]!.id !== cursorRef.current) moveTo(segs[i]!.id);
    }, 200);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, playing, editing, session.id]);

  // Keep the spoken segment in view while following, and the cursor's after a key.
  const speaking = inTransport ? segmentIndexAt(session, playhead) : -1;
  useLayoutEffect(() => {
    if (paused || !follow || speaking < 0 || editing) return;
    rowAt(listRef.current, speaking)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [speaking, paused, follow, editing]);

  const playFrom = (seg: SegmentData) => cue(engine, session.id, seg.start, true);
  const openDetail = (seg: SegmentData) => {
    if (seg.id !== cursor) moveTo(seg.id);
    openFollowing(jali, node.id, clip({ session: session.id, segment: seg.id }));
  };
  const loopSegment = (seg: SegmentData) => {
    if (loop?.segment === seg.id) return engine.setLoop(null);
    cue(engine, session.id, seg.start);
    engine.setLoop({ start: seg.start, end: seg.end, segment: seg.id });
  };
  const save = () => {
    edits.saveCorrections(session.id, Object.fromEntries(changed.map((id) => [id, draft[id]!])));
    setDraft({});
    setEditing(null);
  };
  const discard = () => {
    setDraft({});
    setEditing(null);
  };
  const edit = (seg: SegmentData) => {
    moveTo(seg.id);
    setEditing(seg.id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("textarea, input")) return;
    const to = listMove(e, at, segs.length);
    if (to !== null) {
      moveTo(segs[to]!.id);
      rowAt(listRef.current, to)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && e.altKey) openDetail(current);
    else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) playFrom(current);
    else if ((e.key === "e" || e.key === "E") && !e.metaKey && !e.ctrlKey) edit(current);
    else if ((e.key === "l" || e.key === "L") && !e.metaKey && !e.ctrlKey) loopSegment(current);
    else if (e.key === " " && e.shiftKey) peek(clip({ session: session.id, segment: current.id }));
    else if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
      if (count) save();
    } else return; // not ours: let it bubble (Space plays and pauses, ⌘K opens commands)
    e.preventDefault();
  };

  useCommands([
    {
      id: "save",
      title: "Save corrections",
      keys: keyHint("Mod+S"),
      disabled: count ? false : "No unsaved corrections",
      run: save,
    },
    {
      id: "discard",
      title: "Discard unsaved corrections",
      disabled: count ? false : "No unsaved corrections",
      run: discard,
    },
    {
      id: "play",
      title: "Play from this segment",
      keys: keyHint("Enter"),
      run: () => playFrom(current),
    },
    { id: "edit", title: "Correct this segment", keys: "E", run: () => edit(current) },
    {
      id: "detail",
      title: "Open this segment's detail",
      keys: keyHint("Alt+Enter"),
      run: () => openDetail(current),
    },
    {
      id: "loop",
      title: loop?.segment === current.id ? "Stop looping this segment" : "Loop this segment",
      keys: "L",
      run: () => loopSegment(current),
    },
    {
      id: "rename",
      title: `Rename ${view.speakerName(view.speakerOf(current))}`,
      run: () => setRenaming(current.id),
    },
    {
      id: "follow",
      title: follow ? "Stop following playback" : "Follow playback",
      run: () => setFollow(!follow),
    },
  ]);

  return (
    <div className="pane-body transcript">
      <div className="toolbar">
        <button
          type="button"
          className="key key-latch"
          aria-pressed={follow}
          onMouseDown={keepFocus}
          onClick={() => setFollow(!follow)}
          title="Move the selection, and the segment detail, with the segment being spoken"
        >
          <span className="led" aria-hidden />
          follow playback
        </button>
        <span className="toolbar-note mono">
          {segs.length} segments · {clock(session.duration)}
        </span>
        <span className="toolbar-end">
          {count ? (
            <>
              <span className="unsaved-note" role="status">
                {count} unsaved
              </span>
              <button type="button" className="key" onMouseDown={keepFocus} onClick={discard}>
                Discard
              </button>
              <button
                type="button"
                className="key key-accent"
                onMouseDown={keepFocus}
                onClick={save}
              >
                Save <kbd>{keyHint("Mod+S")}</kbd>
              </button>
            </>
          ) : Object.keys(view.edits.corrections).length ? (
            <span className="toolbar-note">
              {Object.keys(view.edits.corrections).length} corrected
            </span>
          ) : null}
        </span>
      </div>
      {/* The selected segment's keys: real buttons, outside the list, so no control sits inside a row. */}
      <div className="toolbar segment-keys" role="toolbar" aria-label={`Segment ${at + 1}`}>
        <span className="legend">seg {String(at + 1).padStart(2, "0")}</span>
        <span className="keyset" role="group" aria-label="Playback">
          <button
            type="button"
            className="key key-s"
            title={`Play from this segment (${keyHint("Enter")})`}
            onMouseDown={keepFocus}
            onClick={() => playFrom(current)}
          >
            <PlayIcon size={13} weight="fill" aria-hidden />
            <span className="key-word">play</span>
          </button>
          <button
            type="button"
            className="key key-s key-latch"
            aria-pressed={loop?.segment === current.id}
            title="Loop this segment (L)"
            onMouseDown={keepFocus}
            onClick={() => loopSegment(current)}
          >
            <span className="led" aria-hidden />
            <RepeatIcon size={14} aria-hidden />
            <span className="key-word">loop</span>
          </button>
        </span>
        <span className="keyset" role="group" aria-label="Edit">
          <button
            type="button"
            className="key key-s"
            title="Correct this segment (E)"
            onMouseDown={keepFocus}
            onClick={() => edit(current)}
          >
            <NotePencilIcon size={14} aria-hidden />
            <span className="key-word">correct</span>
          </button>
          <button
            type="button"
            className="key key-s"
            title={`Rename ${view.speakerName(view.speakerOf(current))}`}
            onMouseDown={keepFocus}
            onClick={() => setRenaming(current.id)}
          >
            <UserIcon size={14} aria-hidden />
            <span className="key-word">rename</span>
          </button>
        </span>
        <span className="keyset">
          <button
            type="button"
            className="key key-s"
            title={`Open this segment's detail (${keyHint("Alt+Enter")})`}
            onMouseDown={keepFocus}
            onClick={() => openDetail(current)}
          >
            <TextAlignLeftIcon size={14} aria-hidden />
            <span className="key-word">detail</span>
          </button>
        </span>
      </div>
      {!inTransport ? <NotInTransport session={session.id} /> : null}
      <div
        ref={listRef}
        className="tr-rows"
        role="listbox"
        aria-label={`Transcript of ${session.title}`}
        tabIndex={0}
        aria-activedescendant={`${node.id}-${current.id}`}
        onKeyDown={onKeyDown}
      >
        {segs.map((seg, i) => {
          const text = draft[seg.id] ?? view.textOf(seg);
          const speaker = view.speakerOf(seg);
          const prev = segs[i - 1];
          return (
            <Segment
              key={seg.id}
              id={`${node.id}-${seg.id}`}
              seg={seg}
              view={view}
              text={text}
              speaker={speaker}
              speakerName={view.speakerName(speaker)}
              showSpeaker={!prev || view.speakerOf(prev) !== speaker || renaming === seg.id}
              selected={i === at}
              active={focused && i === at}
              progress={progressOf(seg, playhead, view.wordsOf(seg, text))}
              unsaved={changed.includes(seg.id)}
              corrected={!!view.edits.corrections[seg.id]}
              looping={loop?.segment === seg.id}
              editing={editing === seg.id}
              renaming={renaming === seg.id}
              onSelect={() => moveTo(seg.id)}
              onSeek={(t) => cue(engine, session.id, t, playing)}
              onOpen={() => openDetail(seg)}
              onEdit={() => edit(seg)}
              onChange={(value) => setDraft((d) => ({ ...d, [seg.id]: value }))}
              onDoneEditing={() => {
                setEditing(null);
                listRef.current?.focus();
              }}
              onSave={save}
              onRename={() => setRenaming(seg.id)}
              onRenamed={(name) => {
                if (name !== null && name.trim()) edits.renameSpeaker(session.id, speaker, name);
                setRenaming(null);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Keys don't keep focus after a click, so Space goes on playing and pausing. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault();

const rowAt = (list: HTMLElement | null, i: number) =>
  list?.querySelectorAll<HTMLElement>("[data-row]")[i];

/**
 * How far the playhead is through a segment: -1 before it, `Infinity` after it, else the word being spoken (or the
 * last word started, between two words). A segment re-renders only when this changes.
 */
function progressOf(seg: SegmentData, t: number, words: SegmentData["words"]): number {
  if (t < seg.start) return -1;
  if (t >= seg.end) return Infinity;
  const i = wordIndexAt(words, t);
  if (i >= 0) return i;
  let last = -0.5;
  words.forEach((w, k) => {
    if (w[1] <= t) last = k + 0.5;
  });
  return last;
}

interface SegmentProps {
  id: string;
  seg: SegmentData;
  view: SessionView;
  text: string;
  speaker: string;
  speakerName: string;
  showSpeaker: boolean;
  selected: boolean;
  active: boolean;
  progress: number;
  unsaved: boolean;
  corrected: boolean;
  looping: boolean;
  editing: boolean;
  renaming: boolean;
  onSelect(): void;
  onSeek(time: number): void;
  onOpen(): void;
  onEdit(): void;
  onChange(text: string): void;
  onDoneEditing(): void;
  onSave(): void;
  onRename(): void;
  onRenamed(name: string | null): void;
}

function Segment(p: SegmentProps) {
  const words = useMemo(() => p.view.wordsOf(p.seg, p.text), [p.view, p.seg, p.text]);
  const speaking = p.progress >= 0 && p.progress !== Infinity;
  return (
    <div
      id={p.id}
      data-row=""
      role="option"
      aria-selected={p.selected}
      data-active={p.active ? "" : undefined}
      data-speaking={speaking ? "" : undefined}
      data-played={p.progress === Infinity ? "" : undefined}
      data-speaker={p.speaker}
      className="tr-seg"
      onClick={p.onSelect}
      onDoubleClick={p.onEdit}
    >
      {p.showSpeaker ? (
        <div className="tr-speaker">
          {p.renaming ? (
            <SpeakerField name={p.speakerName} onDone={p.onRenamed} />
          ) : (
            // A label, not a button: no control sits inside a row (the rows are options). Clicking it renames, as
            // a convenience; the keyboard has "rename" in the segment keys above and in ⌘K.
            <span
              className="tr-speaker-name"
              title="Rename this speaker"
              onClick={(e) => {
                e.stopPropagation();
                p.onRename();
              }}
            >
              {p.speakerName}
            </span>
          )}
        </div>
      ) : null}
      <div className="tr-line">
        <span
          className="tr-time mono"
          title={`Play from ${clock(p.seg.start)}`}
          onClick={(e) => {
            e.stopPropagation();
            p.onSeek(p.seg.start);
          }}
        >
          {clock(p.seg.start)}
        </span>
        {p.editing ? (
          <Editor text={p.text} onChange={p.onChange} onDone={p.onDoneEditing} onSave={p.onSave} />
        ) : (
          <p className="tr-text">
            {words.map((w, i) => (
              <span
                key={i}
                className="w"
                data-state={
                  p.progress === Infinity || i < p.progress
                    ? "played"
                    : i === p.progress
                      ? "now"
                      : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  p.onSelect();
                  p.onSeek(w[1]);
                }}
              >
                {w[0]}{" "}
              </span>
            ))}
          </p>
        )}
        <span className="tr-marks">
          {p.looping ? <span className="tag tag-signal">Loop</span> : null}
          {p.unsaved ? (
            <span className="tag tag-unsaved" title="Corrected, not saved yet">
              Unsaved
            </span>
          ) : p.corrected ? (
            <span className="tag" title="Corrected and saved">
              Corrected
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** The line being corrected. Esc or ⌘↵ leaves it (the text stays in the draft); ⌘S saves every correction. */
function Editor({
  text,
  onChange,
  onDone,
  onSave,
}: {
  text: string;
  onChange(text: string): void;
  onDone(): void;
  onSave(): void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      className="tr-editor"
      aria-label="Correct the segment's text"
      value={text}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onClick={(e) => e.stopPropagation()}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault(); // ours: the first Esc leaves the field, not Jali's peek or maximise
          onDone();
        } else if (e.key === "Enter") e.preventDefault();
        else if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSave();
        }
      }}
    />
  );
}

/** Rename a speaker in place: Enter or leaving the field saves, Esc keeps the old name. */
function SpeakerField({ name, onDone }: { name: string; onDone(name: string | null): void }) {
  const [value, setValue] = useState(name);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      className="tr-speaker-field"
      aria-label="Speaker's name"
      value={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
    />
  );
}

export const transcript = definePane("transcript", {
  params: transcriptParams,
  title: ({ session }) => `Transcript · ${sessionById(session)?.title ?? session}`,
  icon: TextAlignLeftIcon,
  width: { min: 380, comfortable: 560 },
  height: { min: 240 },
  follow: followSession,
  Component: Transcript,
});
