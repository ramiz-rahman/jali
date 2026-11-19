/**
 * Headlines, about one instrument (`news({ symbol: "LMNA" })`, which can follow a watchlist) or the whole market
 * (`news()`). J/K move, Enter opens a headline, and a symbol on it opens that instrument's quote.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { NewspaperIcon } from "@phosphor-icons/react";
import { definePane, optional, usePaneState, type PaneProps } from "@jali/react";
import { useMarket, useTopic } from "../market/react";
import * as f from "../ui/format";
import { Empty, Segmented } from "../ui/parts";
import { useFollowSymbol } from "./follow";
import { listMove, scrollRowIntoView } from "./keys";
import { quote } from "./quote";

const FRESH_MS = 90_000;

/** `symbol` is optional: without it, the pane shows the whole market's news. */
const newsParams = { symbol: optional(String) };

function News({ params, paused, node, openBeside }: PaneProps<typeof newsParams>) {
  const symbol = params.symbol || undefined;
  useFollowSymbol(news, symbol);
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
    if (to !== null) {
      setAt(to);
      scrollRowIntoView(listRef.current, to);
    } else if (e.key === "Enter" && headlines[at]) {
      const id = headlines[at]!.id;
      setOpen((o) => (o === id ? null : id));
    } else return;
    e.preventDefault();
  };

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
          role="listbox"
          aria-label={only ? `News about ${only}` : "Market news"}
          tabIndex={0}
          aria-activedescendant={headlines[at] ? `${node.id}-n${headlines[at]!.id}` : undefined}
          onKeyDown={onKeyDown}
        >
          {headlines.map((h, i) => (
            <li
              key={h.id}
              id={`${node.id}-n${h.id}`}
              data-row=""
              role="option"
              aria-selected={i === at}
              aria-expanded={open === h.id}
              data-fresh={now - h.time < FRESH_MS ? "" : undefined}
              onClick={() => {
                setAt(i);
                setOpen((o) => (o === h.id ? null : h.id));
              }}
            >
              <span className="news-time">{f.hhmm(h.time)}</span>
              <span className="news-title">{h.title}</span>
              {open === h.id ? (
                <span className="news-body">
                  {h.body} <span className="news-source">{h.source}</span>
                </span>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          openBeside(quote({ symbol: s }));
                        }}
                      >
                        {s}
                      </button>
                    ))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
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
  title: ({ symbol }) => (symbol ? `${symbol} news` : "Market news"),
  icon: NewspaperIcon,
  width: { min: 260, comfortable: 380 },
  height: { min: 200 },
  holdWhileResizing: true,
  Component: News,
});
