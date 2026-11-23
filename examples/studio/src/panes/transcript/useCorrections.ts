/**
 * Corrections are the transcript's work. They are a draft in pane state (kept through folds, tabs and reloads) until
 * the person saves them, and while there are some the pane reports unsaved work: closing it, a preset without it, or
 * the library moving on asks first (or, for a following pane, keeps it on its session and says why, while the
 * library's other followers move on; once saved or discarded it catches up).
 */
import { useMemo, useState } from "react";
import { usePaneState, useUnsaved } from "jali/react";
import type { SessionView } from "../../model/view";
import { segmentById } from "../../sessions/derive";
import type { SegmentData } from "../../sessions/types";
import { text } from "@jali-examples/shared/store";
import { recordOf } from "../../storage";

/** The draft as kept in pane state: corrected text, by segment id. */
const readDraft = (v: unknown) => recordOf(v, text);

export function useCorrections(view: SessionView) {
  const { session } = view;
  const [draft, setDraft] = usePaneState<Record<string, string>>("draft", {}, { parse: readDraft });
  /** The line whose text is open in the editor. */
  const [editing, setEditing] = useState<string | null>(null);

  // The draft's lines that differ from what is saved, for segments this session has: a draft read back from storage
  // may name segments it doesn't (an older build, a hand edit), and those are no work of this session's.
  const changed = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(draft).filter(([id, t]) => {
          const seg = segmentById(session, id);
          return seg !== undefined && t !== view.textOf(seg);
        }),
      ),
    [draft, session, view],
  );
  const count = Object.keys(changed).length;

  // The words Jali shows in "Discard unsaved changes?".
  useUnsaved(
    count > 0 &&
      `${count} unsaved ${count === 1 ? "correction" : "corrections"} in “${session.title}”`,
  );

  const close = () => {
    setDraft({});
    setEditing(null);
  };
  return {
    /** How many lines differ from what is saved. */
    count,
    isChanged: (id: string) => Object.hasOwn(changed, id),
    /** The line's text as the person sees it: the draft's, else the saved one. */
    textOf: (seg: SegmentData) => draft[seg.id] ?? view.textOf(seg),
    write: (id: string, t: string) => setDraft((d) => ({ ...d, [id]: t })),
    editing,
    startEditing: (id: string) => setEditing(id),
    stopEditing: () => setEditing(null),
    save() {
      view.edit.saveCorrections(changed);
      close();
    },
    discard: close,
  };
}

export type Corrections = ReturnType<typeof useCorrections>;
