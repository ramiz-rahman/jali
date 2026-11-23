/**
 * Two ladders side by side (stacked when narrow), by default HTTPS over TCP and TLS 1.3 against HTTP/3 over QUIC,
 * with the difference in round trips spelled out: what it costs on this path, and on slower ones.
 */
import { definePane, useCommands, type PaneProps } from "jali/react";
import { Columns2 } from "lucide-react";
import { Select } from "#src/vendor/cyberspec/components/ui/select.tsx";
import { CAPTURES, captureTitle, DEFAULT_COMPARISON } from "#src/packets/captures.ts";
import { compareLadders, ladderOf } from "#src/packets/ladder.ts";
import { CaptureGate, Provenance, useCapture } from "./parts/capture";
import { LadderDiagram } from "./parts/ladder-diagram";
import { PaneBody } from "./parts/states";
import { packet } from "./packet";

const compareParams = { a: String, b: String };
type Side = keyof typeof compareParams;

const OPTIONS = CAPTURES.map((c) => ({ value: c.id, label: c.title }));

function CompareView({ params, openHere, select }: PaneProps<typeof compareParams>) {
  const a = useCapture(params.a);
  const b = useCapture(params.b);
  const verdict =
    a.status === "ready" && b.status === "ready"
      ? compareLadders(
          { title: a.capture.title, model: ladderOf(a.capture) },
          { title: b.capture.title, model: ladderOf(b.capture) },
        )
      : undefined;
  const isDefault = params.a === DEFAULT_COMPARISON.a && params.b === DEFAULT_COMPARISON.b;
  const showOn = (side: Side, id: string) => openHere(compare({ ...params, [side]: id }));

  useCommands([
    {
      id: "swap",
      title: "Swap the two ladders",
      run: () => openHere(compare({ a: params.b, b: params.a })),
    },
    {
      id: "default",
      title: "Compare TLS 1.3 over TCP with HTTP/3 over QUIC",
      disabled: isDefault ? "Already comparing them" : false,
      run: () => openHere(compare(DEFAULT_COMPARISON)),
    },
  ]);

  const side = (key: Side) => {
    const id = params[key];
    return (
      <section className="pk-compare-side" aria-label={captureTitle(id)}>
        <Select
          label={key === "a" ? "Left" : "Right"}
          options={
            OPTIONS.some((o) => o.value === id)
              ? OPTIONS
              : [...OPTIONS, { value: id, label: captureTitle(id) }]
          }
          value={id}
          onValueChange={(v) => v && showOn(key, v)}
        />
        <CaptureGate id={id} onOpened={(next) => showOn(key, next)}>
          {(capture) => {
            const model = ladderOf(capture);
            return (
              <>
                <Provenance capture={capture} />
                <p className="pk-ladder-summary">{model.summary}</p>
                <LadderDiagram
                  model={model}
                  onPick={(n) => select(packet({ capture: capture.id, n }))}
                  label={`Sequence diagram of ${capture.title}`}
                  idPrefix={`cmp-${key}`}
                />
              </>
            );
          }}
        </CaptureGate>
      </section>
    );
  };

  return (
    <PaneBody className="pk-compare">
      {verdict ? <p className="pk-verdict">{verdict}</p> : null}
      <div className="pk-compare-grid">
        {side("a")}
        {side("b")}
      </div>
    </PaneBody>
  );
}

export const compare = definePane("compare", {
  params: compareParams,
  title: ({ a, b }) => `${captureTitle(a)} vs ${captureTitle(b)}`,
  icon: Columns2,
  width: { min: 320, comfortable: 900 },
  height: { min: 300 },
  Component: CompareView,
});
