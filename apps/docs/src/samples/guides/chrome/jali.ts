import { createJali } from "jali";
import { defaultFeatures } from "jali/features";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const jali = createJali({ panes: orderKinds, presets, features: defaultFeatures() });
