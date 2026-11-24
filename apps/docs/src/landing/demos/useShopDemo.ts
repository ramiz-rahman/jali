/**
 * A shop workspace for one of the landing's demos, embedded as every workspace on the site is, writing its layout
 * into an address that is not the page's (memory by default), with any keys the demo binds of its own.
 */
import { useState } from "react";
import { createJali, memoryLocation, type Jali, type LocationPort } from "jali-layout";
import type { KeyboardOptions } from "jali-layout/adapter";
import { chooser } from "jali-layout/chooser";
import { palette } from "jali-layout/palette";
import { urlSync } from "jali-layout/url";
import {
  buildDemoLayout,
  demoLayouts,
  embedded,
  shopKinds,
  useEmbeddedId,
  type DemoLayoutId,
} from "../../live/embed";

export interface ShopDemo<L extends LocationPort> {
  jali: Jali;
  /** The address the workspace writes. */
  location: L;
}

export function useShopDemo<L extends LocationPort = ReturnType<typeof memoryLocation>>(
  layout: DemoLayoutId,
  options: { location?: () => L; keymap?: KeyboardOptions["keymap"] } = {},
): ShopDemo<L> {
  const id = useEmbeddedId("landing");
  const [demo] = useState(() => {
    const location = (options.location ?? memoryLocation)() as L;
    const base = embedded(id);
    const jali = createJali({
      ...base,
      keyboard: { ...base.keyboard, keymap: options.keymap },
      features: [urlSync({ location }), palette(), chooser()],
      panes: shopKinds,
      layout: buildDemoLayout(layout),
      name: "Shop",
      label: demoLayouts[layout],
    });
    return { jali, location };
  });
  return demo;
}
