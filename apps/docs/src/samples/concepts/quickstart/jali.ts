import { createJali } from "jali";
import { defaultFeatures } from "jali/features";
import { note } from "./note";

export const jali = createJali({
  panes: [note],
  layout: note({ id: 1 }),
  features: defaultFeatures(),
});
