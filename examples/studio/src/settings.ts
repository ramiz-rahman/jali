/**
 * The person's settings for the app itself, on this device: where the control slab sits, and whether keys and dials
 * make a sound. ⌘K changes both (workspace/commands.ts).
 *
 * The slab's place is set as `data-controls` on <html>, which shell.css reads. Only the look moves: the slab stays
 * first in the page for the keyboard and for screen readers.
 */
import { createStore, type Store } from "@jali-examples/shared/store";
import { saved } from "./storage";
import { setFeelSounds } from "./ui/lib/feel";

export type ControlsPlace = "top" | "bottom";

export interface Settings {
  /** Where the control slab (layouts, transport, tools) sits; the status line takes the other edge. */
  controls: ControlsPlace;
  /** Key and dial sounds (ui/lib/feel.ts). On unless the person turned them off. */
  sounds: boolean;
}

const KEYS = { controls: "studio:controls", sounds: "studio:feel-sounds" } as const;

export type SettingsStore = Store<Settings> & {
  setControls(place: ControlsPlace): void;
  setSounds(on: boolean): void;
};

export function createSettings(persist = true): SettingsStore {
  const store = createStore<Settings>({
    controls: persist
      ? saved.read(KEYS.controls, (v) => (v === "bottom" ? "bottom" : "top"))
      : "top",
    sounds: persist ? saved.read(KEYS.sounds, (v) => v !== false) : true,
  });
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    store.set((s) => ({ ...s, [key]: value }));
    if (persist) saved.write(KEYS[key], value);
  };
  return {
    ...store,
    setControls: (place) => change("controls", place),
    setSounds: (on) => change("sounds", on),
  };
}

/** Keeps the page in step with the settings: `data-controls` on <html>, and the key sounds. Call once, at start-up. */
export function applySettings(settings: SettingsStore) {
  const apply = () => {
    const { controls, sounds } = settings.get();
    document.documentElement.dataset.controls = controls;
    setFeelSounds(sounds);
  };
  apply();
  return settings.subscribe(apply);
}
