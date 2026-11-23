/**
 * The app's services beside Jali: the plan and every change to it, what Explore is showing, the place the person
 * last asked to see, and how to tell the person something. Panes read them from context; the workspace's commands
 * get them when it is made (workspace/workspace.ts).
 */
import { createContext, useContext, type ReactNode } from "react";
import type { Plan } from "../trip/plan";
import { summarise, type TripSummary } from "../trip/summary";
import { createPlanChanges, type Notify, type PlanChanges } from "./plan-changes";
import { createPlanStore, type PlanStore } from "./plan-store";
import { createStore, useStore, type Store } from "./store";

/** What an Explore pane shows, for the map to draw: the pane's id and its result ids. */
export interface Results {
  pane: string;
  ids: readonly string[];
}

/**
 * A place the person asked to see (a pin, a stop, a result, ⌘K): each request is a new object, so asking for the
 * same place again is a new request. A layout, a link or Back changes the selection without one, so the map keeps
 * its framing then.
 */
export interface Reveal {
  id: string;
}

export interface Services {
  plan: PlanStore;
  /** Every change the person makes to the plan, each undoable and said in a toast (state/plan-changes.ts). */
  changes: PlanChanges;
  /** The results of the Explore pane on screen, which the map shows as candidates. */
  results: Store<Results | null>;
  /** The place last asked to be shown, which every map brings into view (workspace/hub.ts, `selectPlace`). */
  reveal: Store<Reveal | null>;
  /** A short message for the person, with an optional Undo. */
  notify: Notify;
}

export function createServices({
  persist = true,
  notify = () => {},
  plan: initial,
}: { persist?: boolean; notify?: Notify; plan?: Plan } = {}): Services {
  const plan = createPlanStore(persist, initial);
  return {
    plan,
    changes: createPlanChanges(plan, notify),
    results: createStore<Results | null>(null),
    reveal: createStore<Reveal | null>(null),
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

/** The plan and everything worked out from it (each day's totals, budget and quickest order), shared by every pane. */
export const useSummary = (): TripSummary => summarise(usePlan());
