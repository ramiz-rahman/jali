/** What moves the transcript's list: the voice while following, and the cursor when the pane arrives. */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useJaliState } from "jali-layout/react";
import { showRow } from "../../ui/lib/listbox";

/**
 * How long after the pane comes on screen, a layout opens or the session changes the list keeps showing the cursor's
 * row. Jali settles a list's selection on what a new layout's follower shows a moment after the layout opens, and
 * says nothing when it has (FINDINGS.md, 4), so the cursor's moves during that moment are shown too. After it, only
 * the keys and the playhead move the list.
 */
const SETTLE_MS = 500;

export function useScrolling(
  list: RefObject<HTMLElement | null>,
  {
    paused,
    session,
    cursor,
    speaking,
    following,
  }: {
    paused: boolean;
    session: string;
    /** The cursor's row. */
    cursor: number;
    /** The row being spoken, or -1. */
    speaking: number;
    /** The list moves with the voice. */
    following: boolean;
  },
) {
  useLayoutEffect(() => {
    if (!paused && following && speaking >= 0) showRow(list.current, speaking, { smooth: true });
  }, [list, speaking, paused, following]);

  const presetId = useJaliState((s) => s.presetId);
  const showUntil = useRef(0);
  useLayoutEffect(() => {
    if (!paused) showUntil.current = performance.now() + SETTLE_MS;
  }, [paused, presetId, session]);
  useLayoutEffect(() => {
    if (!paused && performance.now() < showUntil.current) showRow(list.current, cursor);
  }, [list, cursor, paused, presetId, session]);
}
