/**
 * The layouts: four to start from, in ⌘K as "Layout: …" and in the top bar. Rows and columns both: the timeline is a
 * short, wide pane, so it sits under the transcript, over the mixer, or across the bottom.
 *
 * Every layout has one library (id "library"). A pane with `linkedTo: "library", follows: true` shows the session the
 * library's cursor is on. The segment detail follows the transcript (id "transcript") instead; `kept: true` keeps one
 * segment, for comparing. A pane with the same id in two layouts keeps its state across a switch, so a half-done
 * correction comes along from Edit to Review.
 */
import { column, pane, row, type PresetOptions } from "@jali/core";
import { clip } from "./panes/clip";
import { library } from "./panes/library";
import { markers } from "./panes/markers";
import { mixer } from "./panes/mixer";
import { timeline } from "./panes/timeline";
import { transcript } from "./panes/transcript";

export const FIRST_SESSION = "night-ferry";
const session = FIRST_SESSION;
const followsLibrary = { linkedTo: "library", follows: true } as const;
const followsTranscript = { linkedTo: "transcript", follows: true } as const;

const lib = () => pane(library(), { id: "library", weight: 0.8 });
const tr = (weight: number) =>
  pane(transcript({ session }), { id: "transcript", ...followsLibrary, weight });
const tl = (weight: number) =>
  pane(timeline({ session }), { id: "timeline", ...followsLibrary, weight });

export const presets: PresetOptions[] = [
  {
    // Correcting the words: the transcript large, the timeline under it, the segment detail beside.
    id: "edit",
    label: "Edit",
    layout: row(
      lib(),
      column({ weight: 2.6 }, tr(2.6), tl(1)),
      pane(clip({ session, segment: "s01" }), { id: "clip", ...followsTranscript, weight: 1.1 }),
    ),
  },
  {
    // Mixing: the timeline over the mixer, and the markers to jump about with.
    id: "mix",
    label: "Mix",
    layout: row(
      lib(),
      column(
        { weight: 2.6 },
        tl(1),
        pane(mixer({ session }), { id: "mixer", ...followsLibrary, weight: 1.6 }),
      ),
      pane(markers({ session }), { id: "markers", ...followsLibrary, weight: 0.9 }),
    ),
  },
  {
    // Reviewing: the transcript beside the segment detail and the markers, the timeline across the bottom.
    id: "review",
    label: "Review",
    layout: column(
      row(
        { weight: 3 },
        lib(),
        tr(1.7),
        column(
          { weight: 1.2 },
          pane(clip({ session, segment: "s01" }), { id: "clip", ...followsTranscript, weight: 1.5 }),
          // The markers give way first on a narrow screen: the transcript is what Review is for.
          pane(markers({ session }), {
            id: "markers",
            ...followsLibrary,
            weight: 1,
            priority: "supporting",
          }),
        ),
      ),
      tl(1),
    ),
  },
  {
    // Two segments side by side, full height: the left one is kept; the right one follows the transcript, which has
    // the timeline under it. Narrow, the two segments fold into the transcript's tabs.
    id: "compare",
    label: "Compare",
    layout: row(
      pane(library(), { id: "library", weight: 0.7 }),
      column({ weight: 1.5 }, tr(2.2), tl(1)),
      pane(clip({ session, segment: "s04" }), {
        id: "clip-a",
        linkedTo: "transcript",
        kept: true,
      }),
      pane(clip({ session, segment: "s06" }), { id: "clip", ...followsTranscript }),
    ),
  },
];
