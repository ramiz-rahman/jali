/**
 * One segment in detail: its own waveform, play and loop, who says it, and a note. It follows the transcript's
 * selection. Click Following in its header to make it Kept, select another segment, then open that one's detail: two
 * segments side by side, to compare a take or a correction.
 *
 * The note is the pane's work: a draft in pane state until saved, reported with `useUnsaved`. While it has one, the
 * detail stays on its segment when the transcript moves on, and Jali says why.
 */
import { useId } from "react";
import { PauseIcon, PlayIcon, WaveformIcon } from "@phosphor-icons/react";
import { keyHint, type ObjectRef } from "jali-layout";
import {
  definePane,
  useJaliState,
  usePaneState,
  useTitle,
  useUnsaved,
  type PaneProps,
} from "jali-layout/react";
import { useSessionTransport } from "../../audio/react";
import { useSessionView } from "../../model/react";
import type { SessionView } from "../../model/view";
import { useServices } from "../../services";
import { catalogueFor, catalogueOf } from "../../sessions/catalog";
import { segmentById, trackById } from "../../sessions/derive";
import { capitalise, clockTenths, pad } from "../../sessions/format";
import type { SessionId } from "../../sessions/ids";
import { sessionById } from "../../sessions/load";
import type { SegmentData } from "../../sessions/types";
import { stringOrNull } from "../../storage";
import { Key } from "../../ui/atoms/Key";
import { Lamp } from "../../ui/atoms/Lamp";
import { usePaneActions } from "../actions";
import { sessionOf } from "../refs";
import { Missing, NotInTransport, SegmentMissing } from "../states";
import { MiniWave } from "./MiniWave";

const clipParams = { session: String, segment: String };

/** The segment a ref names, if it is a segment detail's ref in a session the library has. */
export function clipOf(
  ref: ObjectRef | undefined,
): { session: SessionId; segment: string } | undefined {
  const session = sessionOf(ref);
  const segment = ref?.params.segment;
  return ref?.kind === clip.kind && session && typeof segment === "string"
    ? { session, segment }
    : undefined;
}

function Clip(props: PaneProps<typeof clipParams>) {
  const view = useSessionView(props.params.session);
  const seg = view && segmentById(view.session, props.params.segment);
  if (!view || !seg) return <Missing what="segment" openHere={props.openHere} />;
  return <ClipBody {...props} view={view} seg={seg} />;
}

function ClipBody({
  paused,
  inPeek,
  node,
  view,
  seg,
}: PaneProps<typeof clipParams> & { view: SessionView; seg: SegmentData }) {
  const { engine, notify } = useServices();
  const { session } = view;
  const n = session.segments.indexOf(seg) + 1;
  // "Segment 8", or "Line 8" in a song's lyrics.
  const word = catalogueOf(session).words.segment;
  const Word = capitalise(word);
  const speaker = view.speakerOf(seg);
  const { inTransport, playing, loop } = useSessionTransport(session.id);
  const looping = loop?.segment === seg.id;
  const saved = view.edits.notes[seg.id] ?? "";
  const [note, setNote] = usePaneState<string | null>("note", null, { parse: stringOrNull });
  const text = view.textOf(seg);
  const dirty = note !== null && note !== saved;
  const noteId = useId();

  useTitle(`${Word} ${n} · ${view.speakerName(speaker)}`);
  useUnsaved(dirty && `an unsaved note on ${word} ${n}`);
  // Jali keeps a follower where it is while it has unsaved work, and its header still reads Following
  // (FINDINGS.md, 1). So the pane says it is held, and what lets it go.
  const listed = useJaliState((s) =>
    node.linkedTo ? clipOf(s.selection[node.linkedTo]?.ref)?.segment : undefined,
  );
  const held = dirty && node.follows && listed !== undefined && listed !== seg.id;

  const inSegment = () => engine.position() >= seg.start && engine.position() < seg.end;
  const saveNote = () => {
    view.edit.saveNote(seg.id, note ?? saved);
    setNote(null);
  };
  const setSpeaker = (to: string) => {
    view.edit.setSegmentSpeaker(seg.id, to);
    notify(`${Word} ${n} is now ${view.speakerName(to)}'s`, {
      undo: () => view.edit.setSegmentSpeaker(seg.id, speaker),
    });
  };

  const play = () =>
    playing && inSegment() ? engine.pause() : engine.cue(session.id, seg.start, true);
  const toggleLoop = () => engine.toggleSegmentLoop(session.id, seg);

  usePaneActions([
    { id: "play", title: `Play ${word} ${n}`, run: play },
    { id: "loop", title: looping ? "Stop looping" : `Loop ${word} ${n}`, run: toggleLoop },
    {
      id: "save-note",
      title: "Save the note",
      keys: [{ key: "s", mod: true }],
      disabled: dirty ? false : "No unsaved note",
      run: saveNote,
    },
  ]);

  return (
    <div className="pane-body clip">
      <header className="clip-head">
        <span className="pane-label">
          {Word} {pad(n)} of {session.segments.length}
        </span>
        <span className="clip-range mono">
          {clockTenths(seg.start)} – {clockTenths(seg.end)}
        </span>
      </header>
      {!inTransport && !inPeek ? <NotInTransport session={session.id} /> : null}
      {held ? (
        <div className="not-live" role="status">
          <span>Held here by its unsaved note. Save or revert the note to follow again.</span>
        </div>
      ) : null}
      <MiniWave
        seg={seg}
        session={session}
        paused={paused}
        inTransport={inTransport}
        looping={looping}
      />
      {/* The keys and the speaker/track LCD on one row when there is room; stacked when narrow. */}
      <div className="clip-row">
        <div className="clip-controls">
          <span className="keyset">
            <Key
              className="key-square key-play"
              aria-label={playing ? "Pause" : `Play ${word} ${n}`}
              onClick={play}
            >
              {playing ? (
                <PauseIcon size={16} weight="fill" aria-hidden />
              ) : (
                <PlayIcon size={16} weight="fill" aria-hidden />
              )}
            </Key>
            <Key className="key-latch" latched={looping} onClick={toggleLoop}>
              loop
            </Key>
          </span>
        </div>
        <dl className="clip-fields">
          <div>
            <dt>Speaker</dt>
            <dd>
              <select
                aria-label={`Who says this ${word}`}
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
              >
                {session.speakers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {view.speakerName(p.id)}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div>
            <dt>Track</dt>
            <dd>{trackById(session, seg.track)?.label}</dd>
          </div>
        </dl>
      </div>
      <blockquote className="clip-text" data-corrected={text !== seg.text ? "" : undefined}>
        {text}
        {text !== seg.text ? <footer>Corrected. Recorded as: “{seg.text}”</footer> : null}
      </blockquote>
      <div className="clip-note">
        <label className="pane-label" htmlFor={noteId}>
          Note
        </label>
        {/* One recess: the page, and under it a row with the state and the two keys. */}
        <div className="pocket notepad" data-dirty={dirty ? "" : undefined}>
          <textarea
            id={noteId}
            value={note ?? saved}
            placeholder="A note for the edit: a retake, a cut, a fact to check."
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              // The note's own keys: ⌘S or ⌘↵ saves it.
              if ((e.key === "s" || e.key === "Enter") && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (dirty) saveNote();
              }
            }}
          />
          <div className="notepad-keys">
            <span className="notepad-state" role="status">
              <Lamp on={dirty} />
              {dirty ? "Not saved" : saved ? "Saved" : "No note"}
            </span>
            <Key disabled={!dirty} onClick={() => setNote(null)}>
              Revert
            </Key>
            <Key className="key-accent" disabled={!dirty} onClick={saveNote}>
              Save note <kbd aria-hidden>{keyHint("Mod+S")}</kbd>
            </Key>
          </div>
        </div>
      </div>
    </div>
  );
}

export const clip = definePane("clip", {
  params: clipParams,
  title: ({ session, segment }) => {
    const n = (sessionById(session)?.segments.findIndex((x) => x.id === segment) ?? -1) + 1;
    const Word = capitalise(catalogueFor(session)?.words.segment ?? "segment");
    return n ? `${Word} ${n}` : Word;
  },
  icon: WaveformIcon,
  width: { min: 300, comfortable: 380, max: 560 },
  height: { min: 280 },
  Component: Clip,
  Missing: SegmentMissing,
});
