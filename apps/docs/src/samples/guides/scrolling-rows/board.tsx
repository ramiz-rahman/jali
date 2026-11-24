import { column, createJali, pane, row } from "jali-layout";
import { definePane } from "jali-layout/react";

// A sales pipeline: every stage is a pane, side by side at a width you can read, in a row that scrolls.
const STAGES = ["Lead", "Qualified", "Demo", "Proposal", "Negotiation", "Won"] as const;

export const stageKind = definePane("stage", {
  params: { name: String },
  title: ({ name }) => name,
  // The width each stage keeps in the row: it never shares out or folds.
  width: { min: 260, comfortable: 300, max: 420 },
  Component: ({ params }) => <StageList stage={params.name} />,
});

export const dealKind = definePane("deal", {
  params: { id: Number },
  title: ({ id }) => `Deal ${id}`,
  width: { min: 300, comfortable: 340 },
  Component: ({ params }) => <DealDetail id={params.id} />,
});

export const jali = createJali({
  panes: [stageKind, dealKind],
  layout: row(
    // Every stage, in a row that scrolls sideways: none folds into a tab, however narrow the window.
    row(
      { id: "pipeline", scroll: "x" },
      ...STAGES.map((name) => pane(stageKind({ name }), { id: name.toLowerCase() })),
    ),
    // Outside the row, the deal stays put while the stages scroll beside it.
    column({ px: 360 }, pane(dealKind({ id: 1042 }), { id: "deal" })),
  ),
});

function StageList({ stage }: { stage: string }) {
  return <p>The deals in {stage}.</p>;
}
function DealDetail({ id }: { id: number }) {
  return <p>Deal {id}.</p>;
}
