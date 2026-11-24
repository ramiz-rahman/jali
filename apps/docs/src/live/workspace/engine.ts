/** The engine's own model, for the live demos that draw Jali's insides (its tree, overlay and boxes). */
import { useSyncExternalStore } from "react";
import { storeOf, type Model } from "jali/adapter";
import { useJali } from "jali/react";

export function useEngineModel(): Model {
  const store = storeOf(useJali());
  return useSyncExternalStore(store.subscribe, store.model, store.model);
}
