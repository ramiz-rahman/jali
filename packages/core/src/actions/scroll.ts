/**
 * Rows that scroll sideways: where one came to rest. The browser scrolls the strip (Scroller in @jali/react); once it
 * rests, its offset comes here, into the view state, where the model, drag hit-tests and the link read it.
 */
import * as core from "../layout";
import type { NodeId } from "../layout/types";
import type { Outcome, Snapshot } from "../state/apply";

/** The strip `strip` has scrolled `offset` px along its content (kept within it, to the px). At its start: none. */
export function setScroll({ s, m }: Snapshot, strip: NodeId, offset: number): Outcome {
  const box = m.content.scrollers.find((r) => r.id === strip);
  if (!box) return null;
  const next = Math.round(core.clampOffset(box, offset));
  if (next === Math.round(s.view.scroll?.[strip] ?? 0)) return null;
  const { [strip]: _, ...others } = s.view.scroll ?? {};
  const scroll = next > 0 ? { ...others, [strip]: next } : others;
  const { scroll: __, ...rest } = s.view;
  return { op: "scroll", view: Object.keys(scroll).length ? { ...rest, scroll } : rest };
}
