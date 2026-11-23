/**
 * The app's own services, beside Jali: the audio engine with its transport, the person's edits, each layout as they
 * left it, their settings, and the way the app tells them something. Panes read them from context; the workspace's
 * commands get them when it is made (workspace/createStudioJali.ts).
 */
import { createContext, useContext, type ReactNode } from "react";
import { createEngine, type Engine } from "./audio/engine";
import { createEdits, type Edits } from "./model/edits";
import { FIRST_SESSION, type SessionId } from "./sessions/ids";
import { createSettings, type SettingsStore } from "./settings";
import { createSavedLayouts, type SavedLayouts } from "./workspace/savedLayouts";

/** A short message for the person ("Marker added at 00:42"), with an Undo when the change can be taken back. */
export type Notify = (text: string, options?: { undo?: () => void }) => void;

export interface Services {
  engine: Engine;
  edits: Edits;
  layouts: SavedLayouts;
  settings: SettingsStore;
  notify: Notify;
}

export function createServices({
  persist = true,
  audio,
  session = FIRST_SESSION,
  notify = () => {},
}: {
  /** Keep the edits, the layouts and the settings on this device (false in tests). */
  persist?: boolean;
  /** Make sound (default: where Web Audio is). */
  audio?: boolean;
  /** The session the transport starts on; its data must be loaded. */
  session?: SessionId;
  notify?: Notify;
} = {}): Services {
  const edits = createEdits(persist);
  return {
    edits,
    layouts: createSavedLayouts(persist),
    settings: createSettings(persist),
    engine: createEngine({ edits, session, audio }),
    notify,
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("useServices needs a <ServicesProvider> above it");
  return s;
}
