/**
 * Headlines, about one instrument (`news({ symbol: "LMNA" })`, which can follow a watchlist) or the whole market
 * (`news()`). J/K move, Enter opens a headline, and a symbol on it opens that instrument's quote.
 *
 * A list of headlines, each a button that shows or hides its story (a disclosure), with its symbols as buttons beside
 * it, never inside it: one control can't hold another. One headline is in the Tab order at a time, and J/K and the
 * arrows move between them.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { NewspaperIcon } from "@phosphor-icons/react";
import { definePane, optional, usePaneState, type PaneProps } from "@jali/react";
import { useMarket, useTopic } from "../market/react";
import * as f from "../ui/format";
import { Empty, Segmented } from "../ui/parts";
import { followSymbol } from "./follow";
import { listMove, scrollRowIntoView } from "./keys";
import { quote } from "./quote";

const FRESH_MS = 90_000;

/** `symbol` is optional: without it, the pane shows the whole market's news. */
const newsParams = { symbol: optional(String) };

function News({ params, paused, node, openBeside }: PaneProps<typeof newsParams>) {
  const symbol = params.symbol || undefined;
  const market = useMarket();
  const [scope, setScope] = usePaneState<"instrument" | "all">("scope", "instrument");
  const only = symbol && scope === "instrument" ? symbol : undefined;
  const headlines = useTopic({ channel: "news", symbol: only }, paused).slice(0, 60);
  const [open, setOpen] = useState<number | null>(null);
  const [at, setAt] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const now = market.snapshot({ channel: "clock" });

  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at, headlines.length);
    if (to === null) return; // Enter and Space are the headline button's own
    e.preventDefault();
    setAt(to);
    scrollRowIntoView(listRef.current, to);
    listRef.current?.querySelectorAll<HTMLElement>(".news-head")[to]?.focus();
  };
  const toggle = (id: number) => setOpen((o) => (o === id ? null : id));
  // Only the current headline and its symbols are in the Tab order.
  const current = Math.min(at, headlines.length - 1);

  return (
    <div className="pane-body news">
      {symbol ? (
        <div className="toolbar">
          <Segmented
            label="Show"
            value={scope}
            onChange={setScope}
            options={[
              { value: "instrument", label: symbol },
              { value: "all", label: "All markets" },
            ]}
          />
        </div>
      ) : null}
      {headlines.length ? (
        <ul
          ref={listRef}
          className="news-list"
          aria-label={only ? `News about ${only}` : "Market news"}
          onKeyDown={onKeyDown}
        >
          {headlines.map((h, i) => {
            const story = `${node.id}-story-${h.id}`;
            const tab = i === current ? 0 : -1;
            return (
              <li
                key={h.id}
                data-row=""
                data-current={i === current ? "" : undefined}
                data-fresh={now - h.time < FRESH_MS ? "" : undefined}
              >
                <button
                  type="button"
                  className="news-head"
                  aria-expanded={open === h.id}
                  aria-controls={open === h.id ? story : undefined}
                  tabIndex={tab}
                  onFocus={() => setAt(i)}
                  onClick={() => {
                    setAt(i);
                    toggle(h.id);
                  }}
                >
                  <span className="news-time">{f.hhmm(h.time)}</span>
                  <span className="news-title">{h.title}</span>
                </button>
                {open === h.id ? (
                  <p className="news-body" id={story}>
                    {h.body} <span className="news-source">{h.source}</span>
                  </p>
                ) : null}
                {h.symbols.some((s) => s !== only) ? (
                  <span className="news-tags">
                    {h.symbols
                      .filter((s) => s !== only)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="chip chip-link"
                          tabIndex={tab}
                          aria-label={`${s} quote`}
                          onClick={() => openBeside(quote({ symbol: s }))}
                        >
                          {s}
                        </button>
                      ))}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : only && market.instrument(only)?.source ? (
        <Empty icon={<NewspaperIcon size={20} aria-hidden />} title={`No news feed for ${only}`}>
          Its prices are real, from {market.instrument(only)!.source}, but there is no free news
          feed tagged by coin. All markets shows the simulated headlines.
        </Empty>
      ) : (
        <Empty icon={<NewspaperIcon size={20} aria-hidden />} title={`No news about ${only} today`}>
          Switch to all markets to see the day's headlines.
        </Empty>
      )}
    </div>
  );
}

export const news = definePane("news", {
  params: newsParams,
  follow: followSymbol,
  title: ({ symbol }) => (symbol ? `${symbol} news` : "Market news"),
  icon: NewspaperIcon,
  width: { min: 260, comfortable: 380 },
  height: { min: 200 },
  holdWhileResizing: true,
  Component: News,
});
