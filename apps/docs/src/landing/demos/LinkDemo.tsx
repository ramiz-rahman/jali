/**
 * The link: a customer beside their notes, under the address the workspace writes, as a browser shows it. The address
 * is one line: where the app is, then the layout the link holds, lit for a moment each time it changes. Back and Forward
 * step through what the workspace wrote, and each step reopens its layout from the address alone: the link is the
 * layout.
 */
import { useState, useSyncExternalStore } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import type { LocationPort } from "jali-layout";
import { NamedWorkspace } from "../../live/embed";
import { useShopDemo } from "./useShopDemo";

/**
 * A browser's history, in memory: the workspace's writes add or replace entries, and Back and Forward move along them
 * as a reader's would, telling the workspace (`subscribe`), which opens the layout the address holds.
 */
function memoryHistory() {
  const entries = [""];
  let index = 0;
  const listeners = new Set<() => void>();
  const go = (to: number) => {
    if (to < 0 || to >= entries.length || to === index) return;
    index = to;
    for (const fn of listeners) fn();
  };
  return {
    search: () => entries[index]!,
    href: () => `memory:${entries[index]!}`,
    navigate(search: string, mode: "push" | "replace") {
      if (mode === "replace") entries[index] = search;
      else {
        entries.splice(index + 1, Infinity, search);
        index += 1;
      }
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    back: () => go(index - 1),
    forward: () => go(index + 1),
    /** Where the reader is in the history: the entry (from 0) and how many there are. */
    at: () => ({ index, length: entries.length }),
  } satisfies LocationPort & Record<string, unknown>;
}
type MemoryHistory = ReturnType<typeof memoryHistory>;

/**
 * The address as a store React can read: its search string and where it is in the history, the same object until one
 * of them changes. A resize is written on a short timer, so it is read again a moment after the workspace settles.
 */
function addressOf(jali: { subscribe(fn: () => void): () => void }, history: MemoryHistory) {
  let last = { search: history.search(), ...history.at() };
  const read = () => {
    const now = { search: history.search(), ...history.at() };
    if (now.search !== last.search || now.index !== last.index || now.length !== last.length)
      last = now;
    return last;
  };
  const subscribe = (fn: () => void) => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const offJali = jali.subscribe(() => {
      fn();
      clearTimeout(t);
      t = setTimeout(fn, 200);
    });
    const offHistory = history.subscribe(fn);
    return () => {
      offJali();
      offHistory();
      clearTimeout(t);
    };
  };
  return { read, subscribe };
}

export function LinkDemo() {
  const { jali, location } = useShopDemo("two", { location: memoryHistory });
  const [address] = useState(() => addressOf(jali, location));
  const { search, index, length } = useSyncExternalStore(
    address.subscribe,
    address.read,
    address.read,
  );
  const [key, value] = decodeURIComponent(search).replace(/^\?/, "").split(/=(.*)/s);
  return (
    <div className="landing-link-demo">
      <div className="landing-address" role="group" aria-label="The address these panes write">
        <span className="landing-address-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="landing-address-nav">
          <button
            type="button"
            aria-label="Back: the layout before"
            title="Back"
            disabled={index === 0}
            onClick={location.back}
          >
            <ArrowLeftIcon size={15} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Forward"
            title="Forward"
            disabled={index === length - 1}
            onClick={location.forward}
          >
            <ArrowRightIcon size={15} aria-hidden />
          </button>
        </span>
        <code
          className="landing-address-url"
          title={`localhost:5173/customers${decodeURIComponent(search)}`}
        >
          <span className="landing-address-where">
            <span className="landing-address-host">localhost:5173</span>/customers
          </span>
          {value !== undefined ? (
            <>
              <span className="landing-address-key">?{key}=</span>
              {/* Keyed by the address, so each new one lights up as it arrives. */}
              <span className="landing-address-value" key={search}>
                {value}
              </span>
            </>
          ) : null}
        </code>
        <span className="landing-address-count" aria-live="polite">
          {index + 1} of {length}
        </span>
      </div>
      <NamedWorkspace
        jali={jali}
        height={340}
        label="A customer and their notes, writing the layout into the address"
      />
    </div>
  );
}
