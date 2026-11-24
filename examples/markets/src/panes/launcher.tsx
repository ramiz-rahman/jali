/**
 * What Split (⌘\) and a tab strip's "+" open: choose what this pane shows. Type a symbol, then pick a view of it,
 * or pick something that isn't about one instrument.
 */
import { useState, type KeyboardEvent } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { definePane, useLauncher, type PaneProps } from "jali-layout/react";
import { DEFAULT_LISTS } from "../model/lists";
import { useMarket } from "../market/react";
import { blotter } from "./blotter";
import { book } from "./book";
import { chart } from "./chart";
import { curve } from "./curve";
import { news } from "./news";
import { quote } from "./quote";
import { tape } from "./tape";
import { watchlist } from "./watchlist";

const VIEWS = [
  { label: "Chart", make: chart },
  { label: "Quote", make: quote },
  { label: "Order book", make: book },
  { label: "Trades", make: tape },
  { label: "News", make: news },
] as const;

function Launcher({ openHere, dismiss }: PaneProps) {
  const market = useMarket();
  const { recent, titleOf } = useLauncher();
  const [symbol, setSymbol] = useState("LMNA");
  const known = market.instrument(symbol);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss(); // an untouched launcher closes quietly
    }
  };

  return (
    <nav
      className="pane-body launcher"
      aria-label="Choose what this pane shows"
      onKeyDown={onKeyDown}
    >
      <section>
        <h3>An instrument</h3>
        <label className="launcher-symbol">
          <span>Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase().trim())}
            list="launcher-symbols"
            autoFocus
            spellCheck={false}
            aria-invalid={!known}
          />
          <datalist id="launcher-symbols">
            {market.instruments.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.name}
              </option>
            ))}
          </datalist>
        </label>
        <p className="launcher-name">{known ? known.name : "No instrument by that symbol"}</p>
        <div className="launcher-grid">
          {VIEWS.map((v) => (
            <button
              key={v.label}
              type="button"
              className="btn"
              disabled={!known}
              onClick={() => openHere(v.make({ symbol }))}
            >
              {v.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>The market</h3>
        <div className="launcher-grid">
          {DEFAULT_LISTS.map((l) => (
            <button
              key={l.id}
              type="button"
              className="btn"
              onClick={() => openHere(watchlist({ list: l.id }))}
            >
              {l.name} list
            </button>
          ))}
          <button type="button" className="btn" onClick={() => openHere(curve())}>
            Yield curve
          </button>
          <button type="button" className="btn" onClick={() => openHere(news())}>
            Market news
          </button>
          <button type="button" className="btn" onClick={() => openHere(blotter())}>
            Blotter
          </button>
        </div>
      </section>
      {recent.length ? (
        <section>
          <h3>Recent</h3>
          <div className="launcher-grid">
            {recent.map((ref) => (
              <button
                key={JSON.stringify(ref)}
                type="button"
                className="btn"
                onClick={() => openHere(ref)}
              >
                {titleOf(ref)}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </nav>
  );
}

export const launcher = definePane("launcher", {
  title: "New pane",
  icon: PlusIcon,
  width: { min: 300 },
  height: { min: 240 },
  scratch: true,
  Component: Launcher,
});
