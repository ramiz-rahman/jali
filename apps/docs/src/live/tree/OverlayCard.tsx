/** The overlay: kept beside the tree, so folding and tucking never rewrite the layout the person made. */
import type { CSSProperties } from "react";
import {
  ArchiveIcon,
  ArrowsInLineHorizontalIcon,
  EyeSlashIcon,
  StackIcon,
} from "@phosphor-icons/react";
import type { Model as JaliModel } from "jali-layout/adapter";
import { colourOf } from "./colours";

function Chips({
  ids,
  m,
  empty,
}: {
  ids: { id: string; note?: string }[];
  m: JaliModel;
  empty: string;
}) {
  if (!ids.length) return <span className="live-ov-none">{empty}</span>;
  return (
    <>
      {ids.map(({ id, note }) => (
        <span
          className="live-ov-chip"
          data-node={id}
          key={id}
          style={{ "--c": colourOf(id) } as CSSProperties}
        >
          {m.title(id)}
          {note ? <small>{note}</small> : null}
        </span>
      ))}
    </>
  );
}

export function OverlayCard({ m }: { m: JaliModel }) {
  const ov = m.layout.overlay;
  const tucks = (ov?.tucks ?? []).map((t) => ({ id: t.pane, note: `behind ${m.title(t.home)}` }));
  const shown = Object.entries(ov?.shown ?? {}).map(([home, id]) => ({
    id,
    note: home !== id ? `in place of ${m.title(home)}` : undefined,
  }));
  return (
    <div className="live-ov" aria-label="Overlay">
      <div className="live-ov-head">
        <span>Overlay</span>
        <small>kept beside the tree, never in it</small>
      </div>
      <dl>
        <div>
          <dt>
            <ArrowsInLineHorizontalIcon size={13} aria-hidden /> Folded
          </dt>
          <dd>
            <Chips ids={m.folded.map((id) => ({ id }))} m={m} empty="nothing: everything fits" />
          </dd>
        </div>
        <div>
          <dt>
            <ArchiveIcon size={13} aria-hidden /> Tucked
          </dt>
          <dd>
            <Chips ids={tucks} m={m} empty="none" />
          </dd>
        </div>
        <div>
          <dt>
            <EyeSlashIcon size={13} aria-hidden /> Hidden
          </dt>
          <dd>
            <Chips ids={m.off.map((id) => ({ id }))} m={m} empty="none" />
          </dd>
        </div>
        {shown.length ? (
          <div>
            <dt>
              <StackIcon size={13} aria-hidden /> Tab shown
            </dt>
            <dd>
              <Chips ids={shown} m={m} empty="none" />
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
