/** The link: a customer beside their notes, under the address the workspace writes. */
import { useState, useSyncExternalStore } from "react";
import { NamedWorkspace } from "../../live/embed";
import { useShopDemo, type ShopDemo } from "./useShopDemo";

/**
 * The address a demo writes (its search string, "?l=…") and how many history entries it has made, as a store React
 * can read: the same object until either changes. A resize is written on a short timer, so it is read again a moment
 * after the store settles.
 */
function addressOf({ jali, location }: ShopDemo) {
  let last = { search: location.search(), entries: location.entries.length };
  const read = () => {
    const search = location.search(),
      entries = location.entries.length;
    if (search !== last.search || entries !== last.entries) last = { search, entries };
    return last;
  };
  const subscribe = (fn: () => void) => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = jali.subscribe(() => {
      fn();
      clearTimeout(t);
      t = setTimeout(fn, 200);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  };
  return { read, subscribe };
}

function useAddress(demo: ShopDemo) {
  const [address] = useState(() => addressOf(demo));
  return useSyncExternalStore(address.subscribe, address.read, address.read);
}

export function LinkDemo() {
  const demo = useShopDemo("two");
  const { search, entries } = useAddress(demo);
  const query = decodeURIComponent(search);
  return (
    <div className="landing-link-demo">
      <div className="landing-address" role="group" aria-label="The address these panes write">
        <span className="landing-address-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <code className="landing-address-url" aria-live="polite">
          <span>localhost:5173/customers</span>
          {query || "?"}
        </code>
        <span className="landing-address-count">{entries} in history</span>
      </div>
      <NamedWorkspace
        jali={demo.jali}
        height={340}
        label="A customer and their notes, writing the layout into the address"
      />
    </div>
  );
}
