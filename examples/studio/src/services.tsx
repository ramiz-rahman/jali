/**
 * The app's own services, beside Jali: the audio engine with its transport, and the person's edits. Panes read them
 * from context; the app's commands get them when the workspace is made (workspace.ts).
 */
import { createContext, useContext, type ReactNode } from "react";
import { createEngine, type Engine } from "./audio/engine";
import { createEdits, type Edits } from "./edits";
import { createLayouts, type Layouts } from "./layouts";
import { SESSIONS } from "./sessions/sessions";

export interface Services {
  engine: Engine;
  edits: Edits;
  /** Each layout as the person left it (layouts.ts). */
  layouts: Layouts;
}

export function createServices({
  persist = true,
  audio,
  session = SESSIONS[0]!.id,
}: { persist?: boolean; audio?: boolean; session?: string } = {}): Services {
  const edits = createEdits(persist);
  return {
    edits,
    layouts: createLayouts(persist),
    engine: createEngine({ edits, session, audio }),
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
