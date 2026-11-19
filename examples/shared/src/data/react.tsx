import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { DataLayer } from "./types";

const DataLayerContext = createContext<DataLayer | null>(null);
export function DataLayerProvider({ value, children }: { value: DataLayer; children?: ReactNode }) {
  return <DataLayerContext.Provider value={value}>{children}</DataLayerContext.Provider>;
}
export function useDataLayer(): DataLayer {
  const layer = useContext(DataLayerContext);
  if (!layer) throw new Error("useDataLayer() outside <DataLayerProvider>");
  return layer;
}
