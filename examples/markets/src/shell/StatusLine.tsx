/**
 * The status line: Jali's shelf (tucked and folded panes, as chips), what has focus, and the keys worth knowing,
 * read from the keymap so they are right on every platform and after any rebinding.
 */
import { Shelf, useJali, useJaliModel, useJaliState } from "jali/react";
import { BuiltWithJali, Maker } from "@jali-examples/shared/maker/maker";
import type { FeedState } from "../market/kraken";
import { useFeed } from "../services";

export function StatusLine() {
  const { keymap } = useJali();
  const focused = useJaliModel((m) => m.panes.find((p) => p.focused)?.title);
  const zoomed = useJaliState((s) => !!s.view.zoomed);
  const keys = (id: string, what: string) =>
    keymap.label(id) ? `${keymap.label(id)} ${what}` : "";
  const hint = zoomed
    ? "Maximised · Esc to restore"
    : [
        "/ search",
        keys("palette.toggle", "commands"),
        keys("pane.focus.next", "next pane"),
        keys("pane.zoom", "maximise"),
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <footer className="status" aria-label="Status">
      <BuiltWithJali />
      <Shelf />
      <span className="status-focus">{focused ?? ""}</span>
      <span className="status-hint">{hint}</span>
      <Source />
      <Maker />
    </footer>
  );
}

const SAY: Record<FeedState, { long: string; short: string }> = {
  connecting: { long: "Connecting to Kraken for crypto prices", short: "Connecting to Kraken" },
  live: { long: "Crypto live from Kraken", short: "Crypto live" },
  down: {
    long: "Kraken can't be reached, trying again: crypto prices may be old",
    short: "Kraken offline",
  },
};

/**
 * Where the prices come from, at every width: everything but crypto is made up, and crypto is live only while the
 * feed is. A change of the feed's state is announced.
 */
function Source() {
  const feed = useFeed();
  const say = feed ? SAY[feed] : undefined;
  return (
    <span className="status-note" data-feed={feed} role="status">
      {say ? (
        <>
          <span className="live-dot" aria-hidden />
          <span className="note-long">{say.long} · every other market is simulated</span>
          <span className="note-short">{say.short} · rest simulated</span>
        </>
      ) : (
        "Simulated market: every company and price is made up"
      )}
    </span>
  );
}
