/**
 * A shop workspace for one of the landing's demos, embedded as every workspace on the site is, writing its layout
 * into an address kept in memory (so this page's own address stays as it is).
 */
import { useState } from "react";
import { createJali, memoryLocation, type Jali } from "jali";
import { chooser } from "jali/chooser";
import { palette } from "jali/palette";
import { urlSync } from "jali/url";
import {
  buildDemoLayout,
  demoLayouts,
  embedded,
  shopKinds,
  useEmbeddedId,
  type DemoLayoutId,
} from "../../live/embed";

export interface ShopDemo {
  jali: Jali;
  /** The address the workspace writes, in memory. */
  location: ReturnType<typeof memoryLocation>;
}

export function useShopDemo(layout: DemoLayoutId): ShopDemo {
  const id = useEmbeddedId("landing");
  const [demo] = useState(() => {
    const location = memoryLocation();
    const jali = createJali({
      ...embedded(id),
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
