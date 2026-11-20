/**
 * Where the control slab (layouts, transport, tools) sits: along the top, or along the bottom with the status line
 * moved up to the top in its place. ⌘K "Controls: move to the bottom / top" switches; the choice is remembered on
 * this device and set as `data-controls` on <html>, which shell.css reads. Only the look moves: the slab stays first
 * in the page for the keyboard and for screen readers.
 */
import { useSyncExternalStore } from "react";
import { saved } from "../store";

export type ControlsPlace = "top" | "bottom";
const KEY = "studio:controls";
const listeners = new Set<() => void>();

export function controlsPlace(): ControlsPlace {
  return saved.read<string>(KEY, "top") === "bottom" ? "bottom" : "top";
}

export function setControlsPlace(v: ControlsPlace) {
  saved.write(KEY, v);
  applyControlsPlace();
  for (const l of listeners) l();
}

/** At start-up, and after a change: the remembered place onto the page. */
export function applyControlsPlace() {
  if (typeof document !== "undefined") document.documentElement.dataset.controls = controlsPlace();
}

export function useControlsPlace(): ControlsPlace {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    controlsPlace,
    () => "top",
  );
}
