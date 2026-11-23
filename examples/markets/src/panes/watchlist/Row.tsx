/** One instrument in a watchlist: its level and change, the touch, and today's path. */
import { dayOf } from "../../market/bars";
import { facts } from "../../market/classes";
import { useTopic } from "../../market/react";
import type { Instrument, Quote } from "../../market/types";
import { Flash } from "../../ui/atoms/Flash";
import { Sparkline } from "../../ui/atoms/Sparkline";
import * as f from "../../ui/format";
import { Delta } from "../../ui/molecules/Delta";

export function Row({
  id,
  inst,
  q,
  selected,
  focused,
  paused,
  group,
  onSelect,
  onOpen,
}: {
  id: string;
  inst: Instrument;
  q: Quote | undefined;
  selected: boolean;
  focused: boolean;
  paused: boolean;
  /** The sector heading above this row, where a new one starts. */
  group?: string;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const level = q ? f.level(inst, q) : undefined;
  return (
    <>
      {group ? (
        <div className="wl-group" role="presentation">
          {group}
        </div>
      ) : null}
      <div
        id={id}
        data-row=""
        role="option"
        aria-selected={selected}
        data-active={selected && focused ? "" : undefined}
        className="wl-row"
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className="c-name">
          <b>{inst.symbol}</b>
          <span className="wl-sub">{inst.name}</span>
        </span>
        {q && level ? (
          <>
            <span className="c-num">
              <Flash value={q.last} dir={q.tickDir}>
                {level.text}
              </Flash>
            </span>
            <span className="c-num">
              <Delta value={level.change}>{level.changeText}</Delta>
            </span>
            <span className="c-num c-vol">{facts(inst).showsVolume ? f.size(q.volume) : ""}</span>
            <span className="c-num c-bid">{f.price(inst, q.bid)}</span>
            <span className="c-num c-ask">{f.price(inst, q.ask)}</span>
            <span className="c-spark">
              <Today inst={inst} base={q.prevClose} paused={paused} />
            </span>
          </>
        ) : (
          // A live price before its first quote: said, not shown as 0.
          <span className="c-pending">Not known yet</span>
        )}
      </div>
    </>
  );
}

/** Today's path against yesterday's close. It redraws every few seconds, not every tick. */
function Today({ inst, base, paused }: { inst: Instrument; base: number; paused: boolean }) {
  const bars = useTopic({ channel: "bars", symbol: inst.symbol, range: "1D" }, paused, {
    throttleMs: 5000,
  });
  const day = dayOf(inst);
  return <Sparkline values={bars.map((b) => b.close)} base={base} slots={day.minutes / day.bar} />;
}
