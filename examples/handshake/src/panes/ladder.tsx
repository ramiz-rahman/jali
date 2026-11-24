/**
 * The ladder: a capture's main conversation as a sequence diagram, the capturing host on the left and the other
 * side on the right. Arrows slope with travel time (the capture point is the left side, so packets leave it and
 * arrive at it at their timestamps), round trips are shaded and counted, and the moment the request can leave is
 * marked. Picking an arrow selects its packet, so the dissection and bytes beside it follow. Narrow, it grows down,
 * never sideways.
 */
import type { ObjectRef } from "jali-layout";
import { definePane, useCommands, useJali, useJaliState, type PaneProps } from "jali-layout/react";
import { ArrowRightLeft } from "lucide-react";
import { captureTitle, counterpart } from "#src/packets/captures.ts";
import { ladderOf } from "#src/packets/ladder.ts";
import type { Capture } from "#src/packets/types.ts";
import { CaptureGate, Provenance } from "./parts/capture";
import { selectUpstream } from "./parts/lab";
import { LadderDiagram } from "./parts/ladder-diagram";
import { Empty, PaneBody } from "./parts/states";
import { compare } from "./compare";
import { packet } from "./packet";

const ladderParams = { capture: String };

function LadderView({
  params,
  node,
  select,
  openHere,
  openBeside,
}: PaneProps<typeof ladderParams>) {
  const other = counterpart(params.capture);
  useCommands([
    {
      id: "compare",
      title: `Compare with ${captureTitle(other)} beside`,
      run: () => openBeside(compare({ a: params.capture, b: other })),
    },
  ]);
  return (
    <PaneBody className="pk-ladder-pane">
      <CaptureGate id={params.capture} onOpened={(capture) => openHere(ladder({ capture }))}>
        {(capture) => <LadderBody capture={capture} node={node} select={select} />}
      </CaptureGate>
    </PaneBody>
  );
}

function LadderBody({
  capture,
  node,
  select,
}: { capture: Capture } & Pick<PaneProps, "node" | "select">) {
  const jali = useJali();
  const model = ladderOf(capture);
  // The packet in view: the list's (or lesson's) selection when this ladder follows one, else its own.
  const source = useJaliState((s) => (node.linkedTo ? s.selection[node.linkedTo]?.ref : undefined));
  const own = useJaliState((s) => s.selection[node.id]?.ref);
  const pick = (r: ObjectRef | undefined) =>
    r?.kind === "packet" && r.params.capture === capture.id ? Number(r.params.n) : undefined;
  return (
    <>
      <div className="pk-packet-head">
        <p className="pk-packet-title">
          <b>{capture.title}</b>
        </p>
        <Provenance capture={capture} />
      </div>
      <p className="pk-ladder-summary">{model.summary}</p>
      {model.arrows.length ? (
        <LadderDiagram
          model={model}
          current={pick(source) ?? pick(own)}
          onPick={(n) => selectUpstream(jali, { node, select }, packet({ capture: capture.id, n }))}
          label={`Sequence diagram of ${capture.title}`}
          idPrefix={node.id}
        />
      ) : (
        <Empty title="No conversation to draw">
          None of this capture's packets are to or from one host.
        </Empty>
      )}
      {model.omitted > 0 ? (
        <p className="pk-muted">{model.omitted} packets outside this conversation are not drawn.</p>
      ) : null}
    </>
  );
}

export const ladder = definePane("ladder", {
  params: ladderParams,
  title: "Ladder",
  icon: ArrowRightLeft,
  width: { min: 300, comfortable: 480, max: 820 },
  height: { min: 260 },
  // A list or a lesson selects packet({ capture, n }): draw that packet's capture, with the packet marked.
  follow: (s) => (s.kind === "packet" ? { capture: String(s.params.capture) } : undefined),
  Component: LadderView,
});
