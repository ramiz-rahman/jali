/**
 * The row above the hero: the step's caption while the tour plays (the things to try otherwise), the tour's controls,
 * and a polite live region that says each caption once.
 */
import type { ReactNode } from "react";
import {
  ArrowCounterClockwiseIcon,
  LinkSimpleIcon,
  PauseIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { buildSearch, type JaliStore } from "jali-layout/adapter";
import type { Tour } from "./useTour";

/** What the address would say for this layout: the same search string Jali writes into a real one. */
function Address({ store }: { store: JaliStore }) {
  const search = buildSearch("", store.get());
  return (
    <span className="live-tour-address" title="The address this layout writes" key={search}>
      <LinkSimpleIcon size={14} aria-hidden />
      <code>
        <span>shop.example/orders</span>
        {decodeURIComponent(search)}
      </code>
    </span>
  );
}

export function TourBar({
  tour,
  store,
  tries,
}: {
  tour: Tour;
  store: JaliStore;
  /** The things to try, shown when the tour is not playing. */
  tries: ReactNode;
}) {
  const playing = tour.status === "playing";
  const step = tour.current;
  return (
    <div className="live-tour-bar" data-status={tour.status}>
      {step ? (
        <span className="live-tour-steps" aria-hidden>
          {Array.from({ length: tour.steps }, (_, i) => (
            <i
              key={i}
              data-at={i === tour.step || undefined}
              data-done={i < tour.step || undefined}
            />
          ))}
        </span>
      ) : null}
      {step ? (
        <div className="live-tour-caption" aria-hidden>
          <span className="live-tour-text" key={tour.step}>
            {step.caption}
          </span>
          {step.aside === "address" ? <Address store={store} /> : null}
        </div>
      ) : (
        tries
      )}
      <span className="live-tour-controls" data-tour-controls="" role="group" aria-label="Tour">
        {tour.status === "done" ? null : (
          <button
            type="button"
            className="live-tour-btn"
            title={playing ? "Pause the tour" : "Play the tour"}
            onClick={tour.toggle}
          >
            {playing ? (
              <PauseIcon size={14} weight="fill" aria-hidden />
            ) : (
              <PlayIcon size={14} weight="fill" aria-hidden />
            )}
            <span>{playing ? "Pause tour" : "Play tour"}</span>
          </button>
        )}
        {tour.status !== "idle" ? (
          <button
            type="button"
            className="live-tour-btn"
            title="Play the tour again from the start"
            onClick={tour.replay}
          >
            <ArrowCounterClockwiseIcon size={14} aria-hidden />
            <span>Replay</span>
          </button>
        ) : null}
      </span>
      <p className="live-sr" aria-live="polite">
        {step?.caption ?? ""}
      </p>
    </div>
  );
}
