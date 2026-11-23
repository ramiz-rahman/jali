/**
 * One line of the transcript: who says it (when it is not the same speaker as the line before), its time, its words
 * lit as they are spoken, and its marks. A row is one option of the list: no control sits inside it, so a screen
 * reader moves through the lines one by one; the selected line's keys sit on the toolbar above.
 */
import { memo, type MouseEvent } from "react";
import type { SessionView } from "../../model/view";
import { colourOf, isSound } from "../../sessions/derive";
import { clock } from "../../sessions/format";
import type { SegmentData } from "../../sessions/types";
import type { ListRow } from "../../ui/lib/listbox";
import { InlineField } from "../../ui/molecules/InlineField";
import { Editor } from "./Editor";
import { wordState, type Progress } from "./lines";

/** A line's state in the list: plain values, so a row re-renders only when its own state changes. */
export interface LineState {
  /** The text shown: the draft's, else the saved one. */
  text: string;
  /** Its start as printed in the gutter: session time, or the mission clock. */
  time: string;
  showSpeaker: boolean;
  /** Starts while an earlier line is still going: two people at once. */
  overlaps: boolean;
  /** Where the playhead is in it. A line before or after the playhead keeps one `Progress` (lines.ts). */
  progress: Progress;
  unsaved: boolean;
  /** Its saved text is a correction. */
  corrected: boolean;
  looping: boolean;
  editing: boolean;
  renaming: boolean;
}

/** What a line asks of the transcript. One set for every line (`useHandlers`), so each takes the line it is for. */
export interface LineHandlers {
  select(seg: SegmentData): void;
  seek(time: number): void;
  edit(seg: SegmentData): void;
  change(seg: SegmentData, text: string): void;
  doneEditing(): void;
  save(): void;
  rename(seg: SegmentData): void;
  /** The new name of the line's speaker, or `null` to keep the old one. */
  renamed(seg: SegmentData, name: string | null): void;
}

/** A click on a part of the row that does something of its own, not the row's select. */
const own = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

type SegmentProps = LineState & {
  /** Its part in the transcript's list (`useListbox`'s `row`): selected, and the keyboard's. */
  row: ListRow;
  seg: SegmentData;
  view: SessionView;
  on: LineHandlers;
};

/** The same row: every prop the same, `row` compared by its values (it is made afresh each render). */
const sameRow = (a: SegmentProps, b: SegmentProps) =>
  (Object.keys(a) as (keyof SegmentProps)[]).every((k) =>
    k === "row"
      ? (Object.keys(a.row) as (keyof ListRow)[]).every((r) => a.row[r] === b.row[r])
      : a[k] === b[k],
  );

export const Segment = memo(function Segment({ row, seg, view, on, ...line }: SegmentProps) {
  const words = view.wordsOf(seg, line.text);
  const speaker = view.speakerOf(seg);
  const name = view.speakerName(speaker);
  const code = view.speakerCode(speaker);
  const { progress } = line;
  return (
    <div
      {...row}
      data-speaking={progress.at === "word" && progress.word >= 0 ? "" : undefined}
      data-played={progress.at === "after" ? "" : undefined}
      data-speaker={speaker}
      data-channel={colourOf(view.session, seg.track)}
      data-overlap={line.overlaps ? "" : undefined}
      className="tr-seg"
      onClick={() => on.select(seg)}
      onDoubleClick={() => on.edit(seg)}
    >
      {line.showSpeaker ? (
        <div className="tr-speaker">
          {line.renaming ? (
            <InlineField
              className="tr-speaker-field"
              label="Speaker's name"
              value={name}
              onDone={(newName) => on.renamed(seg, newName)}
            />
          ) : (
            // A label, not a button: no control sits inside a row. Clicking it renames, as a convenience; the
            // keyboard has "rename" on the toolbar and in ⌘K.
            <span
              className="tr-speaker-name"
              title="Rename this speaker"
              onClick={own(() => on.rename(seg))}
            >
              {code ? <b className="tr-code">{code}</b> : null}
              {name}
            </span>
          )}
        </div>
      ) : null}
      <div className="tr-line">
        <span
          className="tr-time mono"
          title={`Play from ${clock(seg.start)}`}
          data-wide={line.time.length > 5 ? "" : undefined}
          onClick={own(() => on.seek(seg.start))}
        >
          {line.time}
        </span>
        {line.editing ? (
          <Editor
            text={line.text}
            onChange={(text) => on.change(seg, text)}
            onDone={on.doneEditing}
            onSave={on.save}
          />
        ) : (
          <p className="tr-text">
            {words.map(([word, start], i) =>
              isSound(word) ? (
                <span key={i} className="w-tag">
                  {word.slice(1, -1)}{" "}
                </span>
              ) : (
                <span
                  key={i}
                  className="w"
                  data-state={wordState(progress, i)}
                  onClick={own(() => {
                    on.select(seg);
                    on.seek(start);
                  })}
                >
                  {word}{" "}
                </span>
              ),
            )}
          </p>
        )}
        <span className="tr-marks">
          {line.looping ? <span className="tag tag-signal">Loop</span> : null}
          {line.unsaved ? (
            <span className="tag tag-unsaved" title="Corrected, not saved yet">
              Unsaved
            </span>
          ) : line.corrected ? (
            <span className="tag" title="Corrected and saved">
              Corrected
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}, sameRow);
