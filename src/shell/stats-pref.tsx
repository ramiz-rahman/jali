/** The lab's own setting: show fetch and cache stats in the status line. Kept on this device, apart from Jali's. */
import { useSyncExternalStore } from "react";

const KEY = "lab:show-stats";
const subs = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
};
const write = (on: boolean) => {
  try {
    localStorage.setItem(KEY, String(on));
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  subs.forEach((fn) => fn());
};

export const useShowStats = () =>
  useSyncExternalStore(
    (fn) => (subs.add(fn), () => subs.delete(fn)),
    read,
    () => true,
  );

/** The fieldset the lab adds to Jali's settings panel. */
export function StatsSetting() {
  const on = useShowStats();
  return (
    <fieldset>
      <legend>Status line</legend>
      <label className="jali-radio">
        <input type="checkbox" checked={on} onChange={(e) => write(e.target.checked)} />
        <span>Show fetch stats</span>
      </label>
    </fieldset>
  );
}
