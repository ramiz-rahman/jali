/**
 * The layouts: four to start from, in ⌘K as "Layout: …" and in the top bar. Rows and columns both: the timeline is a
 * short, wide pane, so it sits under the transcript, over the mixer, or across the bottom.
 *
 * Every layout has one library (id "library"). A pane with `linkedTo: "library", follows: true` shows the session the
 * library's cursor is on. The segment detail follows the transcript (id "transcript") instead; `kept: true` keeps one
 * segment, for comparing. A pane with the same id in two layouts keeps its state across a switch, so a half-done
 * correction comes along from Edit to Review.
 *
 * The top bar draws each as its plan (shell/layoutPlans.ts).
 */
import { column, pane, row, type PresetOptions } from "jali";
import { clip } from "../panes/clip";
import { library } from "../panes/library";
import { markers } from "../panes/markers";
import { mixer } from "../panes/mixer";
import { timeline } from "../panes/timeline";
import { transcript } from "../panes/transcript";
import { FIRST_SESSION } from "../sessions/ids";

export type PresetId = "edit" | "mix" | "review" | "compare";

const session = FIRST_SESSION;
const followsLibrary = { linkedTo: "library", follows: true } as const;
const followsTranscript = { linkedTo: "transcript", follows: true } as const;

type Place = { weight?: number; priority?: "supporting" };

const libraryPane = (weight = 0.8) => pane(library(), { id: "library", weight });
const transcriptPane = (weight = 1) =>
  pane(transcript({ session }), { id: "transcript", ...followsLibrary, weight });
const timelinePane = () => pane(timeline({ session }), { id: "timeline", ...followsLibrary });
const mixerPane = () => pane(mixer({ session }), { id: "mixer", ...followsLibrary });
const markersPane = (place: Place) =>
  pane(markers({ session }), { id: "markers", ...followsLibrary, ...place });
/** The segment detail that follows the transcript. */
const detailPane = (place: Place, segment = "s01") =>
  pane(clip({ session, segment }), { id: "clip", ...followsTranscript, ...place });

export const presets: (PresetOptions & { id: PresetId })[] = [
  {
    // Correcting the words: the transcript large, the timeline under it, the segment detail beside.
    id: "edit",
    label: "Edit",
    layout: row(
      libraryPane(),
      column({ weight: 2.6 }, transcriptPane(), timelinePane()),
      detailPane({ weight: 1.1 }),
    ),
  },
  {
    // Mixing: the timeline over the mixer, and the markers to jump about with.
    id: "mix",
    label: "Mix",
    layout: row(
      libraryPane(),
      column(
        { weight: 2.6 },
        // The timeline takes its few lanes' height; the mixer's faders get all the rest of the throw.
        timelinePane(),
        mixerPane(),
      ),
      markersPane({ weight: 0.9 }),
    ),
  },
  {
    // Reviewing: the transcript beside the segment detail and the markers, the timeline across the bottom.
    id: "review",
    label: "Review",
    layout: column(
      row(
        libraryPane(),
        transcriptPane(1.7),
        column(
          { weight: 1.2 },
          detailPane({ weight: 1.5 }),
          // The markers give way first on a narrow screen: the transcript is what Review is for.
          markersPane({ weight: 1, priority: "supporting" }),
        ),
      ),
      timelinePane(),
    ),
  },
  {
    // Two segments side by side, full height: the left one is kept; the right one follows the transcript, which has
    // the timeline under it. Narrow, the two segments fold into the transcript's tabs.
    id: "compare",
    label: "Compare",
    layout: row(
      libraryPane(0.7),
      column({ weight: 1.5 }, transcriptPane(), timelinePane()),
      pane(clip({ session, segment: "s39" }), {
        id: "clip-a",
        linkedTo: "transcript",
        kept: true,
      }),
      detailPane({}, "s47"),
    ),
  },
];
