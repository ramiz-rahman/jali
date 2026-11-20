/**
 * The app's services beside Jali: the plan and what Explore is showing. Panes read them from context; the
 * workspace's commands get them when it is made (workspace.ts).
 */
import { createContext, useContext, type ReactNode } from "react";
import {
  createPlanStore,
  createStore,
  useStore,
  type PlanStore,
  type Results,
  type Store,
} from "./store";
import type { Plan } from "./trip/plan";

export interface Services {
  plan: PlanStore;
  /** The results of the Explore pane on screen, which the map shows as candidates. */
  results: Store<Results | null>;
  /** A short message for the person, with an optional Undo. */
  notify: (text: string, options?: { undo?: () => void }) => void;
}

export function createServices({
  persist = true,
  notify = () => {},
  plan,
}: { persist?: boolean; notify?: Services["notify"]; plan?: Plan } = {}): Services {
  return {
    plan: createPlanStore(persist, plan),
    results: createStore<Results | null>(null),
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

/** The plan, re-rendering when it changes. */
export function usePlan(): Plan {
  const { plan } = useServices();
  return useStore(plan, (p) => p);
}
