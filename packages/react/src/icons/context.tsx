import { createContext, useContext, type ReactNode } from "react";
import type { JaliIcons } from "./types";

const IconsContext = createContext<JaliIcons | null>(null);

export function IconsProvider({ icons, children }: { icons: JaliIcons; children?: ReactNode }) {
  return <IconsContext.Provider value={icons}>{children}</IconsContext.Provider>;
}

/** The icons this instance draws with: Jali's own, with the host's `icons` over them. */
export function useJaliIcons(): JaliIcons {
  const icons = useContext(IconsContext);
  if (!icons)
    throw new Error(
      "Jali's icons are missing: render Jali's parts inside <JaliRoot> or <JaliProvider>",
    );
  return icons;
}
