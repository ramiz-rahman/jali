/** `<JaliRoot>` and `<JaliProvider>` as `@jali/react` exports them: Phosphor's icons, with the host's `icons` over them. */
import type { Jali } from "@jali/core";
import { useMemo, type ReactNode } from "react";

import { BareJaliProvider, BareJaliRoot, type JaliRootOptions } from "./JaliRoot";
import { phosphorIcons } from "./icons/phosphor";
import type { JaliIcons } from "./icons/types";

export interface JaliRootProps extends JaliRootOptions {
  /** Your own icons for any of Jali's (`{ close: MyClose }`); the rest stay Phosphor's. */
  icons?: Partial<JaliIcons>;
}

const useIcons = (icons: Partial<JaliIcons> | undefined): JaliIcons =>
  useMemo(() => (icons ? { ...phosphorIcons, ...icons } : phosphorIcons), [icons]);

export function JaliRoot({ icons, ...props }: JaliRootProps) {
  return <BareJaliRoot {...props} icons={useIcons(icons)} />;
}

/** Provides a workspace to the hooks and parts below it. `<JaliRoot>` does this; use it to render Jali's parts on their own. */
export function JaliProvider({
  jali,
  icons,
  children,
}: {
  jali: Jali;
  icons?: Partial<JaliIcons>;
  children?: ReactNode;
}) {
  return (
    <BareJaliProvider jali={jali} icons={useIcons(icons)}>
      {children}
    </BareJaliProvider>
  );
}
