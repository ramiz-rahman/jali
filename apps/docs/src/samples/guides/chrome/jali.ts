import { createJali } from "jali-layout";
import { defaultFeatures } from "jali-layout/features";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const jali = createJali({ panes: orderKinds, presets, features: defaultFeatures() });
